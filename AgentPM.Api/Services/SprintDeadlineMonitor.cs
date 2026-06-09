using AgentPM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AgentPM.Api.Services;

/// <summary>
/// Hosted background service that runs once per day.
/// Finds sprints whose EndDate has passed but are not yet closed and still
/// have unfinished tasks → sends reminder e-mails to assignees and the chef
/// de projet of each affected project.
/// </summary>
public class SprintDeadlineMonitor : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SprintDeadlineMonitor> _log;

    // How often to check (default: every 24 hours).
    private static readonly TimeSpan CheckInterval = TimeSpan.FromHours(24);

    public SprintDeadlineMonitor(IServiceScopeFactory scopeFactory,
                                  ILogger<SprintDeadlineMonitor> log)
    {
        _scopeFactory = scopeFactory;
        _log          = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _log.LogInformation("[SprintDeadlineMonitor] started — checking every {h}h.", CheckInterval.TotalHours);

        // Run an initial check 10 seconds after startup, then on the 24h interval.
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            await RunCheckAsync(stoppingToken);
            await Task.Delay(CheckInterval, stoppingToken);
        }
    }

    /// <summary>Allows manual triggering from a controller (for testing or immediate use).</summary>
    public Task TriggerNowAsync() => RunCheckAsync(CancellationToken.None);

    private async Task RunCheckAsync(CancellationToken ct)
    {
        _log.LogInformation("[SprintDeadlineMonitor] check at {ts:u}", DateTime.UtcNow);

        try
        {
            using var scope  = _scopeFactory.CreateScope();
            var db           = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var email        = scope.ServiceProvider.GetRequiredService<IEmailService>();

            var today    = DateOnly.FromDateTime(DateTime.UtcNow);
            var tomorrow = today.AddDays(1);

            // Load all relevant open sprints in one query
            var sprints = await db.Sprints
                .Where(s => s.Status != "closed"
                         && s.EndDate.HasValue
                         && s.EndDate.Value <= tomorrow)          // overdue OR ending tomorrow
                .Include(s => s.Project)
                    .ThenInclude(p => p.Members)
                        .ThenInclude(m => m.User)
                .Include(s => s.Tasks)
                    .ThenInclude(t => t.Assignee)
                .ToListAsync(ct);

            if (sprints.Count == 0) { _log.LogInformation("[SprintDeadlineMonitor] nothing to notify."); return; }

            foreach (var sprint in sprints)
            {
                var unfinished = sprint.Tasks.Where(t => t.Status != "done").ToList();
                if (unfinished.Count == 0) continue;

                var projectName = sprint.Project.Name;
                var endDate     = sprint.EndDate!.Value;
                var isOverdue   = endDate < today;   // true = already past, false = ends tomorrow (J-1)

                _log.LogInformation(
                    "[SprintDeadlineMonitor] Sprint '{Name}' — {Status} — {Count} unfinished",
                    sprint.Name, isOverdue ? "EN RETARD" : "J-1", unfinished.Count);

                var byAssignee = unfinished
                    .Where(t => t.Assignee != null)
                    .GroupBy(t => t.Assignee!)
                    .ToList();

                var taskRows = unfinished
                    .Select(t => (t.Title, t.Assignee?.FullName ?? "Non assigné"))
                    .ToList();

                // ── Assignees ──────────────────────────────────────────────
                foreach (var grp in byAssignee)
                {
                    var assignee   = grp.Key;
                    var taskTitles = grp.Select(t => t.Title);

                    string subject, html;
                    if (isOverdue)
                    {
                        subject = $"⏰ Rappel : sprint en retard — {sprint.Name}";
                        html    = SprintEmailTemplates.OverdueReminderAssignee(
                                      assignee.FullName, sprint.Name, projectName, endDate, taskTitles);
                    }
                    else
                    {
                        subject = $"📅 Rappel J-1 : le sprint {sprint.Name} se termine demain";
                        html    = SprintEmailTemplates.SprintDueTomorrowAssignee(
                                      assignee.FullName, sprint.Name, projectName, endDate, taskTitles);
                    }
                    await email.SendAsync(assignee.Email, subject, html);
                }

                // ── Chefs de projet ────────────────────────────────────────
                var chefs = sprint.Project.Members
                    .Where(m => m.Role is "admin" or "owner")
                    .Select(m => m.User)
                    .ToList();

                foreach (var chef in chefs)
                {
                    string subject, html;
                    if (isOverdue)
                    {
                        subject = $"⏰ Sprint en retard : {sprint.Name} ({projectName})";
                        html    = SprintEmailTemplates.OverdueReminderChef(
                                      chef.FullName, sprint.Name, projectName, endDate, taskRows);
                    }
                    else
                    {
                        subject = $"📅 J-1 : sprint {sprint.Name} se termine demain ({projectName})";
                        html    = SprintEmailTemplates.SprintDueTomorrowChef(
                                      chef.FullName, sprint.Name, projectName, endDate, taskRows);
                    }
                    await email.SendAsync(chef.Email, subject, html);
                }
            }
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "[SprintDeadlineMonitor] erreur lors de la vérification.");
        }
    }
}
