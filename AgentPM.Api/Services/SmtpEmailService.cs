using System.Net;
using System.Net.Mail;
using AgentPM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AgentPM.Api.Services;

/// <summary>
/// Sends emails via SMTP (Office 365 by default).
///
/// Sender email is resolved AUTOMATICALLY from the database:
///   → first admin user found in the Users table.
/// The only manual config required is Email:Password in appsettings.json.
/// </summary>
public class SmtpEmailService : IEmailService
{
    private readonly IConfiguration       _config;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SmtpEmailService> _log;

    // Cached sender email — resolved once from DB on first send
    private string? _senderEmail;
    private readonly SemaphoreSlim _senderLock = new(1, 1);

    private string Host     => _config["Email:Host"]     ?? "smtp.office365.com";
    private int    Port     => int.TryParse(_config["Email:Port"], out var p) ? p : 587;
    private bool   Ssl      => _config["Email:EnableSsl"] != "false";
    private string Password => _config["Email:Password"] ?? "";
    private string FromName => _config["Email:FromName"] ?? "AgentPM";

    public SmtpEmailService(IConfiguration config, IServiceScopeFactory scopeFactory,
                             ILogger<SmtpEmailService> log)
    {
        _config       = config;
        _scopeFactory = scopeFactory;
        _log          = log;
    }

    // ── Resolve sender email automatically from DB ───────────────────────
    private async Task<string?> GetSenderEmailAsync()
    {
        // Return explicit config value if set
        var configured = _config["Email:Username"];
        if (!string.IsNullOrWhiteSpace(configured)) return configured;

        // Cache DB lookup
        if (_senderEmail != null) return _senderEmail;

        await _senderLock.WaitAsync();
        try
        {
            if (_senderEmail != null) return _senderEmail;

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // Use first admin/owner member found across all projects
            var adminEmail = await db.Set<AgentPM.Domain.Entities.ProjectMember>()
                .Where(m => m.Role == "admin" || m.Role == "owner")
                .Include(m => m.User)
                .Select(m => m.User.Email)
                .FirstOrDefaultAsync();

            _senderEmail = adminEmail;
            if (_senderEmail != null)
                _log.LogInformation("[Email] Expéditeur résolu automatiquement : {Email}", _senderEmail);
            else
                _log.LogWarning("[Email] Aucun chef de projet trouvé en base pour l'expéditeur.");

            return _senderEmail;
        }
        finally { _senderLock.Release(); }
    }

    // ── IEmailService ────────────────────────────────────────────────────
    public async Task SendAsync(string to, string subject, string htmlBody)
    {
        if (string.IsNullOrWhiteSpace(Password))
        {
            _log.LogInformation("[Email – mot de passe manquant] À={To} | Sujet={Subject}", to, subject);
            return;
        }

        var from = await GetSenderEmailAsync();
        if (string.IsNullOrWhiteSpace(from))
        {
            _log.LogWarning("[Email – expéditeur introuvable] À={To} | Sujet={Subject}", to, subject);
            return;
        }

        try
        {
            using var msg = new MailMessage
            {
                From       = new MailAddress(from, FromName),
                Subject    = subject,
                Body       = htmlBody,
                IsBodyHtml = true,
            };
            msg.To.Add(to);

            using var smtp = new SmtpClient(Host, Port)
            {
                Credentials    = new NetworkCredential(from, Password),
                EnableSsl      = Ssl,
                DeliveryMethod = SmtpDeliveryMethod.Network,
            };

            await smtp.SendMailAsync(msg);
            _log.LogInformation("[Email envoyé] De={From} À={To} | Sujet={Subject}", from, to, subject);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "[Email erreur] À={To} | Sujet={Subject}", to, subject);
        }
    }

    public async Task SendManyAsync(IEnumerable<string> recipients, string subject, string htmlBody)
    {
        foreach (var addr in recipients)
            await SendAsync(addr, subject, htmlBody);
    }
}
