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
    private readonly IMediator   _mediator;
    private readonly AppDbContext _db;
    private readonly EventLogger  _events;

    public SprintController(IMediator mediator, AppDbContext db, EventLogger events)
    {
        _mediator = mediator;
        _db       = db;
        _events   = events;
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

    // DELETE api/project/{projectId}/sprints/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid projectId, Guid id)
    {
        var sprint = await _db.Sprints
            .Include(s => s.Tasks)
            .FirstOrDefaultAsync(s => s.Id == id && s.ProjectId == projectId);
        if (sprint is null) return NotFound();

        // Move sprint tasks back to backlog (don't hard-delete them)
        foreach (var t in sprint.Tasks)
            t.SprintId = null;

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
        var result = await _mediator.Send(new CloseSprintCommand(id));
        return Ok(result);
    }
}

public record CreateSprintRequest(
    string Name,
    string? Goal,
    DateOnly? StartDate,
    DateOnly? EndDate
);
