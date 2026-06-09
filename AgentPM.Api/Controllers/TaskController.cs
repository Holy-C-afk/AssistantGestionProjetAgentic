using AgentPM.Api.Models;
using AgentPM.Api.Services;
using AgentPM.Domain.Entities;
using AgentPM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace AgentPM.Api.Controllers;

[ApiController]
[Route("api/tasks")]
public class TaskController : ControllerBase
{
    private readonly AppDbContext        _db;
    private readonly EventLogger         _events;
    private readonly IEmailService       _email;
    private readonly IServiceScopeFactory _scopeFactory;

    public TaskController(AppDbContext db, EventLogger events,
                          IEmailService email, IServiceScopeFactory scopeFactory)
    {
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

        // Role-based filtering: collaborateurs only see their own tasks
        if (projectId.HasValue && CurrentUserId != Guid.Empty)
        {
            var role = await GetProjectRoleAsync(projectId.Value, CurrentUserId);
            if (role == "member")
                query = query.Where(t => t.AssigneeId == CurrentUserId);
        }

        var tasks = await query
            .OrderBy(t => t.Order)
            .ThenByDescending(t => t.CreatedAt)
            .Select(t => new TaskDto(
                t.Id, t.ProjectId, t.SprintId, t.Title, t.Description,
                t.Status, t.Priority, t.StoryPoints,
                t.AssigneeId, t.Assignee != null ? t.Assignee.FullName : null,
                t.CreatedById, t.Order, t.CreatedAt, t.UpdatedAt,
                t.Comments.Count, t.Tags, t.Assignee != null ? t.Assignee.PhotoUrl : null))
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
            t.CreatedById, t.Order, t.CreatedAt, t.UpdatedAt, commentCount, t.Tags, t.Assignee?.PhotoUrl));
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
            Status = "todo",
            Tags = request.Tags ?? []
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

        // ── Reopen sprint & project if a task is added to a closed sprint ─
        bool sprintReopened    = false;
        bool projectReactivated = false;
        if (task.SprintId.HasValue)
        {
            var sprint = await _db.Sprints.FindAsync(task.SprintId.Value);
            if (sprint is not null && sprint.Status == "closed")
            {
                sprint.Status  = "active";
                sprintReopened = true;

                var project = await _db.Projects.FindAsync(sprint.ProjectId);
                if (project is not null && project.Status == "completed")
                {
                    project.Status     = "active";
                    projectReactivated = true;
                }
            }
        }

        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = task.Id },
            new { task = await ToDto(task.Id), sprintReopened, projectReactivated });
    }

    // S3-4: UpdateTask
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTaskRequest request)
    {
        var task = await _db.Tasks.FindAsync(id);
        if (task is null) return NotFound();

        var previousAssigneeId = task.AssigneeId;
        var assigneeChanged    = request.AssigneeId.HasValue && request.AssigneeId != task.AssigneeId;
        object? emailNotification = null;

        if (!string.IsNullOrWhiteSpace(request.Title)) task.Title = request.Title;
        if (request.Description is not null) task.Description = request.Description;
        if (!string.IsNullOrWhiteSpace(request.Priority)) task.Priority = request.Priority;
        if (request.StoryPoints.HasValue) task.StoryPoints = request.StoryPoints.Value;
        if (request.AssigneeId.HasValue) task.AssigneeId = request.AssigneeId.Value;
        if (request.SprintId.HasValue) task.SprintId = request.SprintId.Value;
        if (request.Tags is not null) task.Tags = request.Tags;

        task.UpdatedAt = DateTime.UtcNow;

        if (assigneeChanged)
        {
            await _events.AppendAsync(task.Id, "Task", "TaskAssigned",
                new { task.Id, task.AssigneeId });

            // Collect email data — frontend will send via Graph API (no password needed)
            var assigneeUser  = await _db.Users.FindAsync(request.AssigneeId!.Value);
            var assignerUser  = await _db.Users.FindAsync(CurrentUserId);
            var projectEntity = await _db.Projects.FindAsync(task.ProjectId);
            var sprintEntity  = task.SprintId.HasValue ? await _db.Sprints.FindAsync(task.SprintId.Value) : null;

            if (assigneeUser is not null)
            {
                emailNotification = new
                {
                    to          = assigneeUser.Email,
                    assigneeName = assigneeUser.FullName,
                    taskTitle   = task.Title,
                    taskDesc    = task.Description,
                    taskPrio    = task.Priority,
                    projectName = projectEntity?.Name ?? "—",
                    sprintName  = sprintEntity?.Name  ?? "Backlog",
                    assignerName = assignerUser?.FullName ?? "Un chef de projet",
                };
            }
        }

        await _events.AppendAsync(task.Id, "Task", "TaskUpdated", new
        {
            task.Id,
            task.Title,
            task.Priority,
            task.StoryPoints
        });

        await _db.SaveChangesAsync();

        var dto = await ToDto(task.Id);
        return Ok(new { task = dto, emailNotification });
    }

    // S3-4: MoveTask
    [HttpPatch("{id:guid}/move")]
    public async Task<IActionResult> Move(Guid id, [FromBody] MoveTaskRequest request)
    {
        var task = await _db.Tasks.FindAsync(id);
        if (task is null) return NotFound();

        var validStatuses = new[] { "todo", "clarifier", "in_progress", "done", "blocked" };
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
            To   = task.Status,
            task.Order
        });

        // ── Auto-close sprint when ALL its tasks are done ────────────────
        bool sprintAutoClosed    = false;
        bool projectAutoCompleted = false;

        if (task.SprintId.HasValue && task.Status == "done")
        {
            // Count tasks in the same sprint that are NOT yet done
            // (exclude the current task — it's already set to "done" in memory)
            var pendingCount = await _db.Tasks
                .CountAsync(t => t.SprintId == task.SprintId
                              && t.Id       != task.Id
                              && t.Status   != "done");

            if (pendingCount == 0)
            {
                var sprint = await _db.Sprints.FindAsync(task.SprintId.Value);
                if (sprint is not null && sprint.Status != "closed")
                {
                    sprint.Status    = "closed";
                    sprintAutoClosed = true;

                    await _events.AppendAsync(sprint.Id, "Sprint", "SprintAutoClosed", new
                    {
                        sprint.Id,
                        Reason = "Toutes les tâches sont terminées"
                    });

                    // ── Auto-complete project when ALL its sprints are closed ──
                    var openSprintCount = await _db.Sprints
                        .CountAsync(s => s.ProjectId == sprint.ProjectId
                                      && s.Id        != sprint.Id
                                      && s.Status    != "closed");

                    if (openSprintCount == 0)
                    {
                        var project = await _db.Projects.FindAsync(sprint.ProjectId);
                        if (project is not null && project.Status == "active")
                        {
                            project.Status        = "completed";
                            projectAutoCompleted  = true;

                            await _events.AppendAsync(project.Id, "Project", "ProjectAutoCompleted", new
                            {
                                project.Id,
                                Reason = "Tous les sprints sont clôturés"
                            });
                        }
                    }
                }
            }
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            task              = await ToDto(task.Id),
            sprintAutoClosed,
            projectAutoCompleted
        });
    }

    // S3-4: DeleteTask
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var task = await _db.Tasks.FindAsync(id);
        if (task is null) return NotFound();

        var sprintId = task.SprintId;

        _db.Tasks.Remove(task);
        await _events.AppendAsync(task.Id, "Task", "TaskDeleted", new { task.Id });
        await _db.SaveChangesAsync();

        // ── Auto-close sprint if all remaining tasks are done ────────────
        bool sprintAutoClosed    = false;
        bool projectAutoCompleted = false;

        if (sprintId.HasValue)
        {
            var remainingCount = await _db.Tasks
                .CountAsync(t => t.SprintId == sprintId.Value);

            if (remainingCount > 0)
            {
                var doneCount = await _db.Tasks
                    .CountAsync(t => t.SprintId == sprintId.Value && t.Status == "done");

                if (remainingCount == doneCount)
                {
                    var sprint = await _db.Sprints.FindAsync(sprintId.Value);
                    if (sprint is not null && sprint.Status != "closed")
                    {
                        sprint.Status    = "closed";
                        sprintAutoClosed = true;

                        await _events.AppendAsync(sprint.Id, "Sprint", "SprintAutoClosed", new
                        {
                            sprint.Id,
                            Reason = "Toutes les tâches sont terminées"
                        });

                        var openSprintCount = await _db.Sprints
                            .CountAsync(s => s.ProjectId == sprint.ProjectId
                                          && s.Id       != sprint.Id
                                          && s.Status   != "closed");

                        if (openSprintCount == 0)
                        {
                            var project = await _db.Projects.FindAsync(sprint.ProjectId);
                            if (project is not null && project.Status == "active")
                            {
                                project.Status        = "completed";
                                projectAutoCompleted  = true;

                                await _events.AppendAsync(project.Id, "Project", "ProjectAutoCompleted", new
                                {
                                    project.Id,
                                    Reason = "Tous les sprints sont clôturés"
                                });
                            }
                        }

                        await _db.SaveChangesAsync();
                    }
                }
            }
        }

        return Ok(new { sprintAutoClosed, projectAutoCompleted });
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

    // GET /api/tasks/{id}/pdf
    [HttpGet("{id:guid}/pdf")]
    public async Task<IActionResult> ExportPdf(Guid id)
    {
        var t = await _db.Tasks.AsNoTracking()
            .Include(x => x.Assignee)
            .Include(x => x.Sprint)
            .Include(x => x.CreatedBy)
            .Include(x => x.Comments).ThenInclude(c => c.Author)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (t is null) return NotFound();

        QuestPDF.Settings.License = LicenseType.Community;

        static string PrioLabel(string p) => p switch
        {
            "critical" => "Critique", "high" => "Haute",
            "medium"   => "Moyenne",  "low"  => "Faible", _ => p
        };
        static string StatusLabel(string s) => s switch
        {
            "todo"        => "À faire",    "in_progress" => "En cours",
            "done"        => "Terminé",    "blocked"     => "Bloqué",
            "clarifier"   => "À clarifier", _ => s
        };
        static string PrioColor(string p) => p switch
        {
            "critical" => "#ef4444", "high" => "#f97316",
            "medium"   => "#3b82f6", _      => "#6b7280"
        };

        var pdf = Document.Create(doc =>
        {
            doc.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.DefaultTextStyle(x => x.FontSize(11).FontColor("#374151"));

                // ── Header
                page.Header().BorderBottom(2).BorderColor("#6366f1").PaddingBottom(10).Column(col =>
                {
                    col.Item().Text(t.Title).FontSize(20).Bold().FontColor("#1e1b4b");
                    col.Item().Text($"Tâche  •  Créée le {t.CreatedAt:dd/MM/yyyy}")
                        .FontSize(9).FontColor("#9ca3af");
                });

                page.Content().PaddingTop(18).Column(col =>
                {
                    // ── Meta table
                    col.Item().PaddingBottom(14).Table(tbl =>
                    {
                        tbl.ColumnsDefinition(c => { c.ConstantColumn(130); c.RelativeColumn(); });
                        void Row(string label, string val, string? color = null)
                        {
                            tbl.Cell().Background("#f9fafb").Padding(5).Text(label).Bold().FontSize(10);
                            var cell = tbl.Cell().Padding(5);
                            if (color is not null)
                                cell.Text(val).FontColor(color).Bold();
                            else
                                cell.Text(val);
                        }
                        Row("Statut",    StatusLabel(t.Status));
                        Row("Priorité",  PrioLabel(t.Priority), PrioColor(t.Priority));
                        Row("Assigné à", t.Assignee?.FullName ?? "—");
                        Row("Sprint",    t.Sprint?.Name ?? "Backlog");
                        Row("Créé par",  t.CreatedBy?.FullName ?? "—");
                        Row("Créé le",   t.CreatedAt.ToString("dd/MM/yyyy HH:mm"));
                        Row("Modifié le",t.UpdatedAt.ToString("dd/MM/yyyy HH:mm"));
                        if (t.StoryPoints.HasValue)
                            Row("Story Points", t.StoryPoints.Value.ToString());
                    });

                    // ── Description
                    if (!string.IsNullOrWhiteSpace(t.Description))
                    {
                        col.Item().Text("Description").Bold().FontSize(12).FontColor("#4f46e5");
                        col.Item().PaddingTop(4).PaddingBottom(14)
                            .Background("#f8fafc").Padding(10)
                            .Text(t.Description).FontColor("#374151");
                    }

                    // ── Tags
                    if (t.Tags.Any())
                    {
                        col.Item().Text("Tags").Bold().FontSize(12).FontColor("#4f46e5");
                        col.Item().PaddingTop(4).PaddingBottom(14)
                            .Text(string.Join("  ·  ", t.Tags)).FontColor("#7c3aed");
                    }

                    // ── Comments
                    if (t.Comments.Any())
                    {
                        col.Item().Text($"Commentaires ({t.Comments.Count})")
                            .Bold().FontSize(12).FontColor("#4f46e5");
                        col.Item().PaddingTop(4).Column(cc =>
                        {
                            foreach (var c in t.Comments.OrderBy(x => x.CreatedAt))
                            {
                                cc.Item().PaddingBottom(6).Background("#f9fafb").Padding(8).Column(inner =>
                                {
                                    inner.Item().Row(r =>
                                    {
                                        r.RelativeItem().Text(c.Author?.FullName ?? "?")
                                            .Bold().FontSize(10).FontColor("#1e1b4b");
                                        r.AutoItem().Text(c.CreatedAt.ToString("dd/MM/yyyy HH:mm"))
                                            .FontSize(9).FontColor("#9ca3af");
                                    });
                                    inner.Item().PaddingTop(3).Text(c.Content).FontSize(10);
                                });
                            }
                        });
                    }
                });

                page.Footer().AlignCenter().Text(x =>
                {
                    x.Span("AgentPM  •  ").FontColor("#9ca3af");
                    x.Span(DateTime.Now.ToString("dd/MM/yyyy HH:mm")).FontColor("#9ca3af");
                });
            });
        }).GeneratePdf();

        var fileName = t.Title.Length > 40 ? t.Title[..40] : t.Title;
        return File(pdf, "application/pdf", $"tache-{fileName}.pdf");
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
            t.CreatedById, t.Order, t.CreatedAt, t.UpdatedAt, commentCount, t.Tags, t.Assignee?.PhotoUrl);
    }
}
