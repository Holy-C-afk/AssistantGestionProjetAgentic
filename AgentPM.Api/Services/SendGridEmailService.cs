using System.Text;
using System.Text.Json;
using AgentPM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AgentPM.Api.Services;

/// <summary>
/// Sends emails via the SendGrid v3 REST API.
/// No SMTP password needed — only a SendGrid API key.
///
/// Required in appsettings.json:
///   "Email": { "SendGridApiKey": "SG.xxx", "FromAddress": "no-reply@yourdomain.com", "FromName": "AgentPM" }
///
/// If FromAddress is omitted, it is resolved automatically from the first admin user in the DB.
/// </summary>
public class SendGridEmailService : IEmailService
{
    private const string ApiUrl = "https://api.sendgrid.com/v3/mail/send";

    private readonly IConfiguration        _config;
    private readonly IHttpClientFactory    _http;
    private readonly IServiceScopeFactory  _scopeFactory;
    private readonly ILogger<SendGridEmailService> _log;

    private string? _fromEmail;
    private readonly SemaphoreSlim _fromLock = new(1, 1);

    public SendGridEmailService(IConfiguration config, IHttpClientFactory http,
                                IServiceScopeFactory scopeFactory,
                                ILogger<SendGridEmailService> log)
    {
        _config       = config;
        _http         = http;
        _scopeFactory = scopeFactory;
        _log          = log;
    }

    // ── Resolve "from" address ───────────────────────────────────────────
    private async Task<string?> GetFromEmailAsync()
    {
        var configured = _config["Email:FromAddress"];
        if (!string.IsNullOrWhiteSpace(configured)) return configured;

        if (_fromEmail != null) return _fromEmail;

        await _fromLock.WaitAsync();
        try
        {
            if (_fromEmail != null) return _fromEmail;

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            _fromEmail = await db.Set<AgentPM.Domain.Entities.ProjectMember>()
                .Where(m => m.Role == "admin" || m.Role == "owner")
                .Include(m => m.User)
                .Select(m => m.User.Email)
                .FirstOrDefaultAsync();

            if (_fromEmail != null)
                _log.LogInformation("[SendGrid] Expéditeur résolu depuis la base : {Email}", _fromEmail);
            else
                _log.LogWarning("[SendGrid] Aucun chef de projet trouvé pour l'expéditeur — configurez Email:FromAddress.");

            return _fromEmail;
        }
        finally { _fromLock.Release(); }
    }

    // ── IEmailService ────────────────────────────────────────────────────
    public async Task SendAsync(string to, string subject, string htmlBody)
    {
        var apiKey = _config["Email:SendGridApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _log.LogWarning("[SendGrid] Clé API manquante (Email:SendGridApiKey). Mail non envoyé → {To}", to);
            return;
        }

        var fromEmail = await GetFromEmailAsync();
        var fromName  = _config["Email:FromName"] ?? "AgentPM";

        if (string.IsNullOrWhiteSpace(fromEmail))
        {
            _log.LogWarning("[SendGrid] Adresse expéditeur introuvable. Mail non envoyé → {To}", to);
            return;
        }

        var payload = new
        {
            personalizations = new[]
            {
                new { to = new[] { new { email = to } } }
            },
            from    = new { email = fromEmail, name = fromName },
            subject,
            content = new[]
            {
                new { type = "text/html", value = htmlBody }
            }
        };

        try
        {
            var client  = _http.CreateClient();
            var request = new HttpRequestMessage(HttpMethod.Post, ApiUrl)
            {
                Headers = { { "Authorization", $"Bearer {apiKey}" } },
                Content = new StringContent(
                    JsonSerializer.Serialize(payload),
                    Encoding.UTF8,
                    "application/json")
            };

            var response = await client.SendAsync(request);

            if (response.IsSuccessStatusCode)
                _log.LogInformation("[SendGrid] ✓ Envoyé → {To} | {Subject}", to, subject);
            else
            {
                var body = await response.Content.ReadAsStringAsync();
                _log.LogError("[SendGrid] ✗ {Status} → {To} | {Body}", (int)response.StatusCode, to, body);
            }
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "[SendGrid] Exception lors de l'envoi → {To}", to);
        }
    }

    public async Task SendManyAsync(IEnumerable<string> recipients, string subject, string htmlBody)
    {
        foreach (var addr in recipients)
            await SendAsync(addr, subject, htmlBody);
    }
}
