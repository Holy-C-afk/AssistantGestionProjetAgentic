using AgentPM.Api.Models;
using AgentPM.Api.Services;
using AgentPM.Domain.Entities;
using AgentPM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgentPM.Api.Controllers;

[ApiController]
[Route("api/sprints")]
public class SprintController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly EventLogger _events;

    public SprintController(AppDbContext db, EventLogger events)
    {
        _db = db;
        _events = events;
    }

    // GET /api/sprint?projectId={id}
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] Guid? projectId)
    {
        var query = _db.Sprints.AsNoTracking().AsQueryable();

        if (projectId.HasValue)
            query = query.Where(s => s.ProjectId == projectId.Value);

        var items = await query
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new SprintDto(
                s.Id, s.ProjectId, s.Name, s.Goal,
                s.StartDate.HasValue ? s.StartDate.Value.ToString("yyyy-MM-dd") : null,
                s.EndDate.HasValue ? s.EndDate.Value.ToString("yyyy-MM-dd") : null,
                s.Status, s.Velocity, s.CreatedAt, s.Tasks.Count))
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var s = await _db.Sprints.AsNoTracking()
            .Include(s => s.Tasks)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (s is null) return NotFound();

        return Ok(new SprintDto(
            s.Id, s.ProjectId, s.Name, s.Goal,
            s.StartDate?.ToString("yyyy-MM-dd"),
            s.EndDate?.ToString("yyyy-MM-dd"),
            s.Status, s.Velocity, s.CreatedAt, s.Tasks.Count));
    }

    // S3-2: CreateSprint command
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSprintRequest request)
    {
        var projectExists = await _db.Projects.AnyAsync(p => p.Id == request.ProjectId);
        if (!projectExists) return BadRequest(new { message = "Projet introuvable." });

        var sprint = new Sprint
        {
            ProjectId = request.ProjectId,
            Name = request.Name,
            Goal = request.Goal,
            StartDate = !string.IsNullOrEmpty(request.StartDate)
                ? DateOnly.Parse(request.StartDate) : null,
            EndDate = !string.IsNullOrEmpty(request.EndDate)
                ? DateOnly.Parse(request.EndDate) : null,
            Status = "planned"
        };

        _db.Sprints.Add(sprint);

        await _events.AppendAsync(sprint.Id, "Sprint", "SprintCreated", new
        {
            sprint.Id,
            sprint.ProjectId,
            sprint.Name,
            sprint.Goal,
            sprint.StartDate,
            sprint.EndDate
        });

        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = sprint.Id },
            new SprintDto(sprint.Id, sprint.ProjectId, sprint.Name, sprint.Goal,
                sprint.StartDate?.ToString("yyyy-MM-dd"),
                sprint.EndDate?.ToString("yyyy-MM-dd"),
                sprint.Status, sprint.Velocity, sprint.CreatedAt, 0));
    }

    // S3-2: UpdateSprintGoal command
    [HttpPatch("{id:guid}/goal")]
    public async Task<IActionResult> UpdateGoal(Guid id, [FromBody] UpdateSprintGoalRequest request)
    {
        var sprint = await _db.Sprints.FindAsync(id);
        if (sprint is null) return NotFound();

        sprint.Goal = request.Goal;

        await _events.AppendAsync(sprint.Id, "Sprint", "SprintGoalUpdated", new { sprint.Id, sprint.Goal });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // S3-2: CloseSprint command
    [HttpPost("{id:guid}/close")]
    public async Task<IActionResult> Close(Guid id)
    {
        var sprint = await _db.Sprints.Include(s => s.Tasks).FirstOrDefaultAsync(s => s.Id == id);
        if (sprint is null) return NotFound();
        if (sprint.Status == "closed") return BadRequest(new { message = "Sprint déjà clos." });

        sprint.Status = "closed";
        sprint.Velocity = sprint.Tasks
            .Where(t => t.Status == "done" && t.StoryPoints.HasValue)
            .Sum(t => t.StoryPoints!.Value);

        await _events.AppendAsync(sprint.Id, "Sprint", "SprintClosed", new
        {
            sprint.Id,
            sprint.Velocity,
            ClosedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
        return NoContent();
    }

    // S3-5: GetSprintBoard query — tasks grouped by status column
    [HttpGet("{id:guid}/board")]
    public async Task<IActionResult> GetBoard(Guid id)
    {
        var sprint = await _db.Sprints.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id);
        if (sprint is null) return NotFound();

        var tasks = await _db.Tasks.AsNoTracking()
            .Where(t => t.SprintId == id)
            .Include(t => t.Assignee)
            .OrderBy(t => t.Order)
            .ThenByDescending(t => t.CreatedAt)
            .Select(t => new TaskDto(
                t.Id, t.ProjectId, t.SprintId, t.Title, t.Description,
                t.Status, t.Priority, t.StoryPoints,
                t.AssigneeId, t.Assignee != null ? t.Assignee.FullName : null,
                t.CreatedById, t.Order, t.CreatedAt, t.UpdatedAt,
                t.Comments.Count))
            .ToListAsync();

        var columns = new[] { "todo", "in_progress", "done", "blocked" }
            .ToDictionary(k => k, k => tasks.Where(t => t.Status == k).ToList());

        var sprintDto = new SprintDto(
            sprint.Id, sprint.ProjectId, sprint.Name, sprint.Goal,
            sprint.StartDate?.ToString("yyyy-MM-dd"),
            sprint.EndDate?.ToString("yyyy-MM-dd"),
            sprint.Status, sprint.Velocity, sprint.CreatedAt, tasks.Count);

        return Ok(new SprintBoardDto(sprintDto, columns));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var sprint = await _db.Sprints.FindAsync(id);
        if (sprint is null) return NotFound();

        _db.Sprints.Remove(sprint);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
