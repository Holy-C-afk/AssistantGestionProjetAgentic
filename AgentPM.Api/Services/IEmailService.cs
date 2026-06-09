namespace AgentPM.Api.Services;

public interface IEmailService
{
    /// <summary>Sends a single HTML email. Silently skips if SMTP is not configured.</summary>
    Task SendAsync(string to, string subject, string htmlBody);

    /// <summary>Sends the same email to several recipients (one call per address).</summary>
    Task SendManyAsync(IEnumerable<string> recipients, string subject, string htmlBody);
}
