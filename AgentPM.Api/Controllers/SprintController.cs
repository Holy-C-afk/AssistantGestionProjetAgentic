using AgentPM.Api.Services;
using AgentPM.Application.Features.Sprints.Commands;
using AgentPM.Application.Features.Sprints.Queries;
using AgentPM.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgentPM.Api.Controllers;

[ApiController]
[Route("api/project/{projectId:guid}/sprints")]
public class SprintController : ControllerBase
{
    private readonly IMediator            _mediator;
    private readonly AppDbContext         _db;
    private readonly EventLogger          _events;
    private readonly IEmailService        _email;
    private readonly IServiceScopeFactory _scopeFactory;

    public SprintController(IMediator mediator, AppDbContext db, EventLogger events,
                             IEmailService email, IServiceScopeFactory scopeFactory)
    {
        _mediator     = mediator;
        _db           = db;
        _events       = events;
        _email        = email;
        _scopeFactory = scopeFactory;
    }

    private Guid CurrentUserId
    {
        get
        {
            if (Request.Headers.TryGetValue("X-User-Id", out var v) && Guid.TryParse(v, out var id))
                return id;
            return Guid.Empty;
        }
    }

    private async Task<string> GetProjectRoleAsync(Guid projectId, Guid userId)
    {
        var member = await _db.ProjectMembers
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.ProjectId == projectId && m.UserId == userId);
        return member?.Role ?? "member";
    }

    // GET api/project/{projectId}/sprints
    [HttpGet]
    public async Task<IActionResult> GetSprints(Guid projectId)
    {
        var result = await _mediator.Send(new GetSprintsQuery(projectId));
        return Ok(result);
    }

    // GET api/project/{projectId}/sprints/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid projectId, Guid id)
    {
        var result = await _mediator.Send(new GetSprintByIdQuery(id));
        return Ok(result);
    }

    // POST api/project/{projectId}/sprints
    [HttpPost]
    public async Task<IActionResult> Create(Guid projectId, [FromBody] CreateSprintRequest request)
    {
        // ── Date validation ──────────────────────────────────────────────
        if (request.StartDate.HasValue && request.EndDate.HasValue
            && request.StartDate >= request.EndDate)
            return BadRequest(new { message = "La date de début doit être antérieure à la date de fin." });

        var result = await _mediator.Send(new CreateSprintCommand(
            projectId,
            request.Name,
            request.Goal,
            request.StartDate,
            request.EndDate));

        // ── Reactivate project if it was marked completed ────────────────
        bool projectReactivated = false;
        var project = await _db.Projects.FindAsync(projectId);
        if (project is not null && project.Status == "completed")
        {
            project.Status = "active";
            projectReactivated = true;
            await _events.AppendAsync(project.Id, "Project", "ProjectReactivated", new
            {
                project.Id,
                Reason = "Nouveau sprint ajouté"
            });
            await _db.SaveChangesAsync();
        }

        return CreatedAtAction(nameof(GetById), new { projectId, id = result.Id },
            new { sprint = result, projectReactivated });
    }

    // PATCH api/project/{projectId}/sprints/{id}/dates
    [HttpPatch("{id:guid}/dates")]
    public async Task<IActionResult> UpdateDates(Guid projectId, Guid id,
        [FromBody] UpdateSprintDatesRequest request)
    {
        var sprint = await _db.Sprints
            .FirstOrDefaultAsync(s => s.Id == id && s.ProjectId == projectId);
        if (sprint is null) return NotFound();

        if (request.StartDate.HasValue && request.EndDate.HasValue
            && request.StartDate >= request.EndDate)
            return BadRequest(new { message = "La date de début doit être antérieure à la date de fin." });

        if (request.StartDate.HasValue) sprint.StartDate = request.StartDate;
        if (request.EndDate.HasValue)   sprint.EndDate   = request.EndDate;
        // Allow clearing a date by passing null explicitly
        if (request.ClearEndDate == true) sprint.EndDate = null;

        await _db.SaveChangesAsync();
        return Ok(new { sprint.Id, sprint.StartDate, sprint.EndDate });
    }

    // DELETE api/project/{projectId}/sprints/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid projectId, Guid id, [FromQuery] bool force = false)
    {
        var sprint = await _db.Sprints
            .Include(s => s.Tasks)
            .FirstOrDefaultAsync(s => s.Id == id && s.ProjectId == projectId);
        if (sprint is null) return NotFound();

        // Block deletion if any task is already started (not "todo"), unless an admin/owner forces it
        var startedTasks = sprint.Tasks.Where(t => t.Status != "todo").ToList();
        if (startedTasks.Any())
        {
            if (!force)
                return BadRequest(new
                {
                    message = $"Impossible de supprimer : {startedTasks.Count} tâche(s) déjà commencée(s) ou terminée(s).",
                    requiresForce = true,
                    startedCount  = startedTasks.Count,
                });

            var role = await GetProjectRoleAsync(projectId, CurrentUserId);
            if (role != "admin" && role != "owner")
                return StatusCode(403, new { message = "Seul le chef de projet peut forcer la suppression d'un sprint avec des tâches en cours." });
        }

        // Move sprint tasks back to backlog (don't hard-delete them)
        foreach (var t in sprint.Tasks)
        {
            t.SprintId   = null;
            t.UpdatedAt  = DateTime.UtcNow;
        }

        await _events.AppendAsync(sprint.Id, "Sprint", "SprintDeleted", new
        {
            sprint.Id,
            sprint.Name,
            Forced       = force && startedTasks.Any(),
            TasksToBacklog = sprint.Tasks.Count,
        });

        _db.Sprints.Remove(sprint);
        await _db.SaveChangesAsync();

        // ── Auto-complete project if all remaining sprints are closed ────
        bool projectAutoCompleted = false;
        var totalRemaining = await _db.Sprints.CountAsync(s => s.ProjectId == projectId);
        if (totalRemaining > 0)
        {
            var openSprintCount = await _db.Sprints
                .CountAsync(s => s.ProjectId == projectId && s.Status != "closed");

            if (openSprintCount == 0)
            {
                var project = await _db.Projects.FindAsync(projectId);
                if (project is not null && project.Status == "active")
                {
                    project.Status = "completed";
                    projectAutoCompleted = true;
                    await _events.AppendAsync(project.Id, "Project", "ProjectAutoCompleted", new
                    {
                        project.Id,
                        Reason = "Tous les sprints sont clôturés"
                    });
                    await _db.SaveChangesAsync();
                }
            }
        }

        return Ok(new { projectAutoCompleted });
    }

    // POST api/project/{projectId}/sprints/{id}/close
    [HttpPost("{id:guid}/close")]
    public async Task<IActionResult> Close(Guid projectId, Guid id)
    {
        // Load sprint with all relationships needed for email notifications
        var sprint = await _db.Sprints
            .Where(s => s.Id == id && s.ProjectId == projectId)
            .Include(s => s.Project)
                .ThenInclude(p => p.Members)
                    .ThenInclude(m => m.User)
            .Include(s => s.Tasks)
                .ThenInclude(t => t.Assignee)
            .FirstOrDefaultAsync();

        if (sprint is null) return NotFound();

        // ── Block closure if unfinished tasks remain ─────────────────────
        var unfinished = sprint.Tasks.Where(t => t.Status != "done").ToList();
        if (unfinished.Any())
        {
            var projectName = sprint.Project.Name;

            // Capture data before Task.Run (sprint entity may be collected)
            var sprintName    = sprint.Name;
            var sprintEndDate = sprint.EndDate;
            var unfinishedSnap = unfinished.Select(t => new
            {
                t.Title,
                AssigneeEmail = t.Assignee?.Email,
                AssigneeName  = t.Assignee?.FullName,
            }).ToList();
            var chefEmails = sprint.Project.Members
                .Where(m => m.Role is "admin" or "owner")
                .Select(m => new { m.User.Email, m.User.FullName })
                .ToList();

            // Send notifications in background — use captured primitives (no _db / EF entities)
            _ = Task.Run(async () =>
            {
                try
                {
                    // 1. Notify each assignee
                    foreach (var grp in unfinishedSnap
                        .Where(t => t.AssigneeEmail != null)
                        .GroupBy(t => new { t.AssigneeEmail, t.AssigneeName }))
                    {
                        var taskTitles = grp.Select(t => t.Title);
                        var subject    = $"⚠️ Sprint en cours de clôture — tâches non terminées : {sprintName}";
                        var html       = SprintEmailTemplates.AssigneeNotification(
                                             grp.Key.AssigneeName!, sprintName,
                                             projectName, taskTitles, sprintEndDate);
                        await _email.SendAsync(grp.Key.AssigneeEmail!, subject, html);
                    }

                    // 2. Notify all chefs de projet
                    var taskRows = unfinishedSnap
                        .Select(t => (t.Title, t.AssigneeName ?? "Non assigné"))
                        .ToList();

                    foreach (var chef in chefEmails)
                    {
                        var subject = $"🚫 Clôture bloquée : sprint {sprintName} ({projectName})";
                        var html    = SprintEmailTemplates.ChefDeProjetNotification(
                                          chef.FullName, sprintName, projectName,
                                          unfinishedSnap.Count, taskRows, sprintEndDate);
                        await _email.SendAsync(chef.Email, subject, html);
                    }
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[SprintClose email error] {ex.Message}");
                }
            });

            return BadRequest(new
            {
                message = $"Impossible de clôturer le sprint : {unfinished.Count} tâche(s) non terminée(s). " +
                          "Les personnes concernées ont été notifiées par e-mail.",
                unfinishedCount = unfinished.Count,
                unfinishedTasks = unfinished.Select(t => new
                {
                    t.Id,
                    t.Title,
                    t.Status,
                    AssigneeName = t.Assignee?.FullName
                })
            });
        }

        // ── All tasks done — proceed with closure ────────────────────────
        sprint.Status   = "closed";
        sprint.Velocity = sprint.Tasks.Sum(t => t.StoryPoints ?? 0);
        await _db.SaveChangesAsync();

        await _events.AppendAsync(sprint.ProjectId, "Sprint", "SprintClosed",
            new { sprint.Id, sprint.Name, sprint.Velocity });
        await _db.SaveChangesAsync();

        return Ok(new
        {
            sprint.Id,
            sprint.ProjectId,
            sprint.Name,
            sprint.Status,
            sprint.Velocity
        });
    }
}

public record CreateSprintRequest(
    string Name,
    string? Goal,
    DateOnly? StartDate,
    DateOnly? EndDate
);

public record UpdateSprintDatesRequest(
    DateOnly? StartDate,
    DateOnly? EndDate,
    bool? ClearEndDate = false
);
