using AgentPM.Api.Models;
using AgentPM.Api.Services;
using AgentPM.Domain.Entities;
using AgentPM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgentPM.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TaskController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly EventLogger _events;

    public TaskController(AppDbContext db, EventLogger events)
    {
        _db = db;
        _events = events;
    }

    private async Task<Guid> GetSystemUserIdAsync()
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == "system@agentpm.local");
        if (user is null)
        {
            user = new User
            {
                Email = "system@agentpm.local",
                FullName = "System User",
                PasswordHash = string.Empty,
                Role = "admin"
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();
        }
        return user.Id;
    }

    // GET /api/task?projectId=..&sprintId=..&status=..
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? projectId,
        [FromQuery] Guid? sprintId,
        [FromQuery] string? status,
        [FromQuery] Guid? assigneeId)
    {
        var query = _db.Tasks.AsNoTracking().Include(t => t.Assignee).AsQueryable();

        if (projectId.HasValue) query = query.Where(t => t.ProjectId == projectId.Value);
        if (sprintId.HasValue) query = query.Where(t => t.SprintId == sprintId.Value);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(t => t.Status == status);
        if (assigneeId.HasValue) query = query.Where(t => t.AssigneeId == assigneeId.Value);

        var tasks = await query
            .OrderBy(t => t.Order)
            .ThenByDescending(t => t.CreatedAt)
            .Select(t => new TaskDto(
                t.Id, t.ProjectId, t.SprintId, t.Title, t.Description,
                t.Status, t.Priority, t.StoryPoints,
                t.AssigneeId, t.Assignee != null ? t.Assignee.FullName : null,
                t.CreatedById, t.Order, t.CreatedAt, t.UpdatedAt,
                t.Comments.Count))
            .ToListAsync();

        return Ok(tasks);
    }

    // S3-5: GetTaskById query
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var t = await _db.Tasks.AsNoTracking()
            .Include(x => x.Assignee)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (t is null) return NotFound();

        var commentCount = await _db.TaskComments.CountAsync(c => c.TaskId == id);

        return Ok(new TaskDto(
            t.Id, t.ProjectId, t.SprintId, t.Title, t.Description,
            t.Status, t.Priority, t.StoryPoints,
            t.AssigneeId, t.Assignee?.FullName,
            t.CreatedById, t.Order, t.CreatedAt, t.UpdatedAt, commentCount));
    }

    // S3-4: CreateTask
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTaskRequest request)
    {
        var projectExists = await _db.Projects.AnyAsync(p => p.Id == request.ProjectId);
        if (!projectExists) return BadRequest(new { message = "Projet introuvable." });

        var creatorId = await GetSystemUserIdAsync();

        var maxOrder = await _db.Tasks
            .Where(t => t.ProjectId == request.ProjectId && t.Status == "todo")
            .MaxAsync(t => (int?)t.Order) ?? 0;

        var task = new TaskItem
        {
            ProjectId = request.ProjectId,
            SprintId = request.SprintId,
            Title = request.Title,
            Description = request.Description,
            Priority = request.Priority ?? "medium",
            StoryPoints = request.StoryPoints,
            AssigneeId = request.AssigneeId,
            CreatedById = creatorId,
            Order = maxOrder + 1,
            Status = "todo"
        };

        _db.Tasks.Add(task);

        await _events.AppendAsync(task.Id, "Task", "TaskCreated", new
        {
            task.Id,
            task.ProjectId,
            task.SprintId,
            task.Title,
            task.AssigneeId
        });

        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = task.Id },
            await ToDto(task.Id));
    }

    // S3-4: UpdateTask
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTaskRequest request)
    {
        var task = await _db.Tasks.FindAsync(id);
        if (task is null) return NotFound();

        var assigneeChanged = request.AssigneeId.HasValue && request.AssigneeId != task.AssigneeId;

        if (!string.IsNullOrWhiteSpace(request.Title)) task.Title = request.Title;
        if (request.Description is not null) task.Description = request.Description;
        if (!string.IsNullOrWhiteSpace(request.Priority)) task.Priority = request.Priority;
        if (request.StoryPoints.HasValue) task.StoryPoints = request.StoryPoints.Value;
        if (request.AssigneeId.HasValue) task.AssigneeId = request.AssigneeId.Value;
        if (request.SprintId.HasValue) task.SprintId = request.SprintId.Value;

        task.UpdatedAt = DateTime.UtcNow;

        if (assigneeChanged)
        {
            await _events.AppendAsync(task.Id, "Task", "TaskAssigned",
                new { task.Id, task.AssigneeId });
        }

        await _events.AppendAsync(task.Id, "Task", "TaskUpdated", new
        {
            task.Id,
            task.Title,
            task.Priority,
            task.StoryPoints
        });

        await _db.SaveChangesAsync();

        return Ok(await ToDto(task.Id));
    }

    // S3-4: MoveTask
    [HttpPatch("{id:guid}/move")]
    public async Task<IActionResult> Move(Guid id, [FromBody] MoveTaskRequest request)
    {
        var task = await _db.Tasks.FindAsync(id);
        if (task is null) return NotFound();

        var validStatuses = new[] { "todo", "in_progress", "done", "blocked" };
        if (!validStatuses.Contains(request.Status))
            return BadRequest(new { message = "Statut invalide." });

        var fromStatus = task.Status;
        task.Status = request.Status;
        if (request.Order.HasValue) task.Order = request.Order.Value;
        task.UpdatedAt = DateTime.UtcNow;

        await _events.AppendAsync(task.Id, "Task", "TaskMoved", new
        {
            task.Id,
            From = fromStatus,
            To = task.Status,
            task.Order
        });

        await _db.SaveChangesAsync();

        return Ok(await ToDto(task.Id));
    }

    // S3-4: DeleteTask
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var task = await _db.Tasks.FindAsync(id);
        if (task is null) return NotFound();

        _db.Tasks.Remove(task);

        await _events.AppendAsync(task.Id, "Task", "TaskDeleted", new { task.Id });

        await _db.SaveChangesAsync();
        return NoContent();
    }

    // S3-10: AddComment
    [HttpPost("{id:guid}/comments")]
    public async Task<IActionResult> AddComment(Guid id, [FromBody] AddCommentRequest request)
    {
        var taskExists = await _db.Tasks.AnyAsync(t => t.Id == id);
        if (!taskExists) return NotFound();

        if (string.IsNullOrWhiteSpace(request.Content))
            return BadRequest(new { message = "Le commentaire ne peut pas être vide." });

        var authorId = request.AuthorId ?? await GetSystemUserIdAsync();

        var comment = new TaskComment
        {
            TaskId = id,
            AuthorId = authorId,
            Content = request.Content
        };

        _db.TaskComments.Add(comment);

        await _events.AppendAsync(id, "Task", "CommentAdded", new
        {
            CommentId = comment.Id,
            TaskId = id,
            authorId,
            request.Content
        });

        await _db.SaveChangesAsync();

        var author = await _db.Users.AsNoTracking()
            .Where(u => u.Id == authorId)
            .Select(u => u.FullName)
            .FirstOrDefaultAsync() ?? "Unknown";

        return Ok(new TaskCommentDto(
            comment.Id, comment.TaskId, comment.AuthorId,
            author, comment.Content, comment.CreatedAt));
    }

    // S3-10: GetComments
    [HttpGet("{id:guid}/comments")]
    public async Task<IActionResult> GetComments(Guid id)
    {
        var comments = await _db.TaskComments.AsNoTracking()
            .Where(c => c.TaskId == id)
            .Include(c => c.Author)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new TaskCommentDto(
                c.Id, c.TaskId, c.AuthorId, c.Author.FullName,
                c.Content, c.CreatedAt))
            .ToListAsync();

        return Ok(comments);
    }

    [HttpDelete("{id:guid}/comments/{commentId:guid}")]
    public async Task<IActionResult> DeleteComment(Guid id, Guid commentId)
    {
        var comment = await _db.TaskComments
            .FirstOrDefaultAsync(c => c.Id == commentId && c.TaskId == id);
        if (comment is null) return NotFound();

        _db.TaskComments.Remove(comment);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<TaskDto> ToDto(Guid id)
    {
        var t = await _db.Tasks.AsNoTracking()
            .Include(x => x.Assignee)
            .FirstAsync(x => x.Id == id);

        var commentCount = await _db.TaskComments.CountAsync(c => c.TaskId == id);

        return new TaskDto(
            t.Id, t.ProjectId, t.SprintId, t.Title, t.Description,
            t.Status, t.Priority, t.StoryPoints,
            t.AssigneeId, t.Assignee?.FullName,
            t.CreatedById, t.Order, t.CreatedAt, t.UpdatedAt, commentCount);
    }
}
