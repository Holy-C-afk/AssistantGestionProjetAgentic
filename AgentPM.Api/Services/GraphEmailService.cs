using System.Net.Http.Headers;
using System.Text.Json;

namespace AgentPM.Api.Services;

/// <summary>
/// Sends emails via Microsoft Graph API using the application's Azure AD
/// client-credentials (same tenant / app registration already configured).
///
/// Required Azure AD app permissions (application, not delegated):
///   • Mail.Send
///
/// Config values read from the existing "AzureAd" section:
///   TenantId     — already present
///   ClientId     — already present
///   ClientSecret — add to appsettings.Development.json (gitignored)
///   SenderEmail  — shared mailbox or any licensed user with a mailbox
/// </summary>
public class GraphEmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _http;
    private readonly ILogger<GraphEmailService> _log;

    // Simple in-memory token cache
    private string?  _token;
    private DateTime _tokenExpiry = DateTime.MinValue;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public GraphEmailService(IConfiguration config, IHttpClientFactory http,
                              ILogger<GraphEmailService> log)
    {
        _config = config;
        _http   = http;
        _log    = log;
    }

    // ── Configuration helpers ────────────────────────────────────────────
    private string TenantId     => _config["AzureAd:TenantId"]     ?? "";
    private string ClientId     => _config["AzureAd:ClientId"]     ?? "";
    private string ClientSecret => _config["AzureAd:ClientSecret"] ?? "";
    private string SenderEmail  => _config["AzureAd:SenderEmail"]  ?? "";

    private bool IsConfigured =>
        !string.IsNullOrWhiteSpace(TenantId)     &&
        !string.IsNullOrWhiteSpace(ClientId)     &&
        !string.IsNullOrWhiteSpace(ClientSecret) &&
        !string.IsNullOrWhiteSpace(SenderEmail);

    // ── Token acquisition (client_credentials flow) ──────────────────────
    private async Task<string?> GetTokenAsync()
    {
        if (_token != null && DateTime.UtcNow < _tokenExpiry)
            return _token;

        await _lock.WaitAsync();
        try
        {
            // Double-check after acquiring lock
            if (_token != null && DateTime.UtcNow < _tokenExpiry)
                return _token;

            var client = _http.CreateClient("GraphToken");
            var body = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"]    = "client_credentials",
                ["client_id"]     = ClientId,
                ["client_secret"] = ClientSecret,
                ["scope"]         = "https://graph.microsoft.com/.default",
            });

            var resp = await client.PostAsync(
                $"https://login.microsoftonline.com/{TenantId}/oauth2/v2.0/token", body);

            if (!resp.IsSuccessStatusCode)
            {
                var err = await resp.Content.ReadAsStringAsync();
                _log.LogError("[GraphEmail] Token error {Status}: {Body}", resp.StatusCode, err);
                return null;
            }

            using var doc    = await JsonDocument.ParseAsync(await resp.Content.ReadAsStreamAsync());
            var root         = doc.RootElement;
            _token           = root.GetProperty("access_token").GetString();
            var expiresIn    = root.GetProperty("expires_in").GetInt32();
            _tokenExpiry     = DateTime.UtcNow.AddSeconds(expiresIn - 60); // 1-min safety margin
            return _token;
        }
        finally { _lock.Release(); }
    }

    // ── IEmailService ────────────────────────────────────────────────────
    public async Task SendAsync(string to, string subject, string htmlBody)
    {
        if (!IsConfigured)
        {
            _log.LogInformation(
                "[GraphEmail – not configured] To={To} Subject={Subject}", to, subject);
            return;
        }

        try
        {
            var token = await GetTokenAsync();
            if (token is null) return;

            var client = _http.CreateClient("GraphSend");
            client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", token);

            // Graph sendMail payload
            var payload = new
            {
                message = new
                {
                    subject,
                    body          = new { contentType = "HTML", content = htmlBody },
                    toRecipients  = new[] { new { emailAddress = new { address = to } } },
                    from          = new { emailAddress = new { address = SenderEmail, name = "AgentPM" } },
                },
                saveToSentItems = false,
            };

            var response = await client.PostAsJsonAsync(
                $"https://graph.microsoft.com/v1.0/users/{Uri.EscapeDataString(SenderEmail)}/sendMail",
                payload);

            if (response.IsSuccessStatusCode)
                _log.LogInformation("[GraphEmail sent] To={To} Subject={Subject}", to, subject);
            else
            {
                var err = await response.Content.ReadAsStringAsync();
                _log.LogError("[GraphEmail error] {Status} – {Body}", response.StatusCode, err);
            }
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "[GraphEmail exception] To={To}", to);
        }
    }

    public async Task SendManyAsync(IEnumerable<string> recipients, string subject, string htmlBody)
    {
        foreach (var addr in recipients)
            await SendAsync(addr, subject, htmlBody);
    }
}
