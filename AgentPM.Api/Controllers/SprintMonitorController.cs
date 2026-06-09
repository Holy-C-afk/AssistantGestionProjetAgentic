using AgentPM.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace AgentPM.Api.Controllers;

/// <summary>
/// Allows manually triggering the sprint deadline check without waiting 24 hours.
/// Useful after creating a new sprint to immediately send J-1 / overdue notifications.
/// </summary>
[ApiController]
[Route("api/sprint-monitor")]
public class SprintMonitorController : ControllerBase
{
    private readonly SprintDeadlineMonitor _monitor;
    private readonly ILogger<SprintMonitorController> _log;

    public SprintMonitorController(SprintDeadlineMonitor monitor,
                                    ILogger<SprintMonitorController> log)
    {
        _monitor = monitor;
        _log     = log;
    }

    /// <summary>
    /// POST /api/sprint-monitor/trigger
    /// Runs the deadline check immediately and sends any pending J-1 / overdue emails.
    /// </summary>
    [HttpPost("trigger")]
    public async Task<IActionResult> Trigger()
    {
        _log.LogInformation("[SprintMonitor] Déclenchement manuel demandé.");
        await _monitor.TriggerNowAsync();
        return Ok(new { success = true, message = "Vérification exécutée. Consultez les logs pour le détail." });
    }
}
