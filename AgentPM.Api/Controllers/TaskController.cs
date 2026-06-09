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
    private readonly NotificationService _notifications;

    public TaskController(AppDbContext db, EventLogger events,
                          IEmailService email, IServiceScopeFactory scopeFactory,
                          NotificationService notifications)
    {
        _db           = db;
        _events       = events;
        _email        = email;
        _scopeFactory = scopeFactory;
        _notifications = notifications;
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

        // Role-based filtering: collaborateurs only see tasks assigned to them
        if (projectId.HasValue && CurrentUserId != Guid.Empty)
        {
            var role = await GetProjectRoleAsync(projectId.Value, CurrentUserId);
            if (role == "member")
                query = query.Where(t =>
                    t.AssigneeId == CurrentUserId ||
                    t.AssigneeIds.Contains(CurrentUserId));
        }

        var tasks = await query
            .OrderBy(t => t.Order)
            .ThenByDescending(t => t.CreatedAt)
            .Select(t => new TaskDto(
                t.Id, t.ProjectId, t.SprintId, t.Title, t.Description,
                t.Status, t.Priority, t.StoryPoints,
                t.AssigneeId, t.Assignee != null ? t.Assignee.FullName : null,
                t.CreatedById, t.Order, t.CreatedAt, t.UpdatedAt,
                t.Comments.Count, t.Tags,
                t.Assignee != null ? t.Assignee.PhotoUrl : null,
                t.AssigneeIds, null))   // AssigneeNames resolved lazily
            .ToListAsync();

        return Ok(tasks);
    }

    // S3-5: GetTaskById query
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var exists = await _db.Tasks.AnyAsync(x => x.Id == id);
        if (!exists) return NotFound();
        return Ok(await ToDto(id));
    }

    // S3-4: CreateTask
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTaskRequest request)
    {
        var projectExists = await _db.Projects.AnyAsync(p => p.Id == request.ProjectId);
        if (!projectExists) return BadRequest(new { message = "Projet introuvable." });

        // Use the logged-in user as creator; fall back to system only if header missing
        var creatorId = CurrentUserId != Guid.Empty ? CurrentUserId : await GetSystemUserIdAsync();

        var maxOrder = await _db.Tasks
            .Where(t => t.ProjectId == request.ProjectId && t.Status == "todo")
            .MaxAsync(t => (int?)t.Order) ?? 0;

        // Merge AssigneeId + AssigneeIds into a single canonical list
        var assigneeIds = request.AssigneeIds?.Where(id => id != Guid.Empty).Distinct().ToList() ?? [];
        if (request.AssigneeId.HasValue && !assigneeIds.Contains(request.AssigneeId.Value))
            assigneeIds.Insert(0, request.AssigneeId.Value);

        var task = new TaskItem
        {
            ProjectId  = request.ProjectId,
            SprintId   = request.SprintId,
            Title      = request.Title,
            Description = request.Description,
            Priority   = request.Priority ?? "medium",
            StoryPoints = request.StoryPoints,
            AssigneeId  = assigneeIds.Count > 0 ? assigneeIds[0] : null,
            AssigneeIds = assigneeIds,
            CreatedById = creatorId,
            Order  = maxOrder + 1,
            Status = "todo",
            Tags   = request.Tags ?? []
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
        // Build canonical assignee list from the request
        List<Guid>? newAssigneeIds = null;
        if (request.AssigneeIds is not null)
        {
            newAssigneeIds = request.AssigneeIds.Where(id => id != Guid.Empty).Distinct().ToList();
            // Also fold in the single AssigneeId if provided
            if (request.AssigneeId.HasValue && !newAssigneeIds.Contains(request.AssigneeId.Value))
                newAssigneeIds.Insert(0, request.AssigneeId.Value);
        }
        else if (request.AssigneeId.HasValue)
        {
            newAssigneeIds = [request.AssigneeId.Value];
        }

        var oldIds = task.AssigneeIds.ToHashSet();
        var newIds = newAssigneeIds?.ToHashSet() ?? oldIds;
        var assigneeChanged = newAssigneeIds is not null && !oldIds.SetEquals(newIds);

        if (!string.IsNullOrWhiteSpace(request.Title)) task.Title = request.Title;
        if (request.Description is not null) task.Description = request.Description;
        if (!string.IsNullOrWhiteSpace(request.Priority)) task.Priority = request.Priority;
        if (request.StoryPoints.HasValue) task.StoryPoints = request.StoryPoints.Value;
        if (newAssigneeIds is not null)
        {
            task.AssigneeIds = newAssigneeIds;
            task.AssigneeId  = newAssigneeIds.Count > 0 ? newAssigneeIds[0] : null;
        }
        if (request.SprintId.HasValue) task.SprintId = request.SprintId.Value;
        if (request.Tags is not null) task.Tags = request.Tags;

        task.UpdatedAt = DateTime.UtcNow;

        if (assigneeChanged)
        {
            await _events.AppendAsync(task.Id, "Task", "TaskAssigned",
                new { task.Id, task.AssigneeId });

            // Resolve data now (before SaveChanges / scope disposal)
            var newlyAdded    = newIds.Except(oldIds).ToList();
            var assigneeUsers = await _db.Users.Where(u => newlyAdded.Contains(u.Id)).ToListAsync();
            var assignerUser  = await _db.Users.FindAsync(CurrentUserId);
            var projectEntity = await _db.Projects.FindAsync(task.ProjectId);
            var sprintEntity  = task.SprintId.HasValue ? await _db.Sprints.FindAsync(task.SprintId.Value) : null;

            if (assigneeUsers.Count > 0)
            {
                var taskTitle    = task.Title;
                var taskDesc     = task.Description;
                var taskPrio     = task.Priority;
                var projectName  = projectEntity?.Name ?? "—";
                var sprintName   = sprintEntity?.Name  ?? "Backlog";
                var assignerName = assignerUser?.FullName ?? "Un chef de projet";
                var recipients   = assigneeUsers.Select(u => (u.Email, u.FullName)).ToList();

                _ = Task.Run(async () =>
                {
                    try
                    {
                        using var scope = _scopeFactory.CreateScope();
                        var emailSvc    = scope.ServiceProvider.GetRequiredService<IEmailService>();

                        foreach (var (email, name) in recipients)
                        {
                            var subject = $"📋 Nouvelle tâche assignée : {taskTitle}";
                            var html    = SprintEmailTemplates.TaskAssigned(
                                              name, taskTitle, taskDesc,
                                              taskPrio, projectName, sprintName, assignerName);
                            await emailSvc.SendAsync(email, subject, html);
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine($"[TaskAssigned email] {ex.Message}");
                    }
                });

                // In-app / real-time notifications for newly assigned users
                foreach (var u in assigneeUsers)
                {
                    await _notifications.SendAsync(
                        u.Id,
                        "Nouvelle tâche assignée",
                        $"\"{taskTitle}\" vous a été assignée par {assignerName} ({projectName} — {sprintName}).",
                        "task_assigned",
                        projectId: task.ProjectId,
                        sprintId:  task.SprintId,
                        taskId:    task.Id);
                }
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
        return Ok(new { task = dto });
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

        // ── Only a chef de projet (admin) can move a task OUT of "done" ──────
        var activeStatuses = new[] { "todo", "clarifier", "in_progress" };
        if (fromStatus == "done" && activeStatuses.Contains(request.Status))
        {
            var role = await GetProjectRoleAsync(task.ProjectId, CurrentUserId);
            if (role != "admin" && role != "owner")
                return StatusCode(403, new { message = "Seul le chef de projet peut rouvrir une tâche terminée." });
        }

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

        bool sprintAutoClosed     = false;
        bool projectAutoCompleted = false;
        bool sprintReopened       = false;
        bool projectReactivated   = false;
        bool sprintActivated      = false;

        if (task.SprintId.HasValue)
        {
            // ── A task starts moving (in_progress, done, blocked, clarifier) → sprint leaves "planned" ──
            if (task.Status != "todo")
            {
                var sprint = await _db.Sprints.FindAsync(task.SprintId.Value);
                if (sprint is not null && sprint.Status == "planned")
                {
                    sprint.Status   = "active";
                    sprintActivated = true;

                    await _events.AppendAsync(sprint.Id, "Sprint", "SprintActivated", new
                    {
                        sprint.Id,
                        Reason = "Une tâche du sprint a démarré"
                    });
                }
            }

            // ── Moving a task OUT of "done" → reopen closed sprint ────────────
            if (fromStatus == "done" && activeStatuses.Contains(task.Status))
            {
                var sprint = await _db.Sprints.FindAsync(task.SprintId.Value);
                if (sprint is not null && (sprint.Status == "closed" || sprint.Status == "completed"))
                {
                    sprint.Status  = "active";
                    sprintReopened = true;

                    await _events.AppendAsync(sprint.Id, "Sprint", "SprintReopened", new
                    {
                        sprint.Id,
                        Reason = "Une tâche terminée a été réouverte par le chef de projet"
                    });

                    // ── Reactivate project if it was closed/completed ─────────
                    var project = await _db.Projects.FindAsync(sprint.ProjectId);
                    if (project is not null
                        && project.Status != "active"
                        && project.Status != "archived")
                    {
                        project.Status      = "active";
                        projectReactivated  = true;

                        await _events.AppendAsync(project.Id, "Project", "ProjectReactivated", new
                        {
                            project.Id,
                            Reason = "Un sprint a été réouvert"
                        });
                    }
                }
            }

            // ── Moving a task TO "done" → auto-close sprint if all tasks done ─
            else if (task.Status == "done")
            {
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

                        // ── Auto-complete project when ALL sprints closed ──────
                        var openSprintCount = await _db.Sprints
                            .CountAsync(s => s.ProjectId == sprint.ProjectId
                                          && s.Id        != sprint.Id
                                          && s.Status    != "closed");

                        if (openSprintCount == 0)
                        {
                            var project = await _db.Projects.FindAsync(sprint.ProjectId);
                            if (project is not null && project.Status == "active")
                            {
                                project.Status       = "completed";
                                projectAutoCompleted = true;

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
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            task              = await ToDto(task.Id),
            sprintAutoClosed,
            projectAutoCompleted,
            sprintReopened,
            projectReactivated,
            sprintActivated
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

        // ── Fix "System User" creator: fall back to the project admin ──────
        string createdByName;
        if (t.CreatedBy is null || t.CreatedBy.Email == "system@agentpm.local")
        {
            var projectAdmin = await _db.ProjectMembers
                .Include(m => m.User)
                .Where(m => m.ProjectId == t.ProjectId && (m.Role == "admin" || m.Role == "owner"))
                .Select(m => m.User)
                .FirstOrDefaultAsync();
            createdByName = projectAdmin?.FullName ?? "—";
        }
        else
        {
            createdByName = t.CreatedBy.FullName ?? "—";
        }

        // ── Resolve all assignees (multi-assignee aware) ────────────────────
        var assigneeIds = t.AssigneeIds.Count > 0
            ? t.AssigneeIds
            : (t.AssigneeId.HasValue ? new List<Guid> { t.AssigneeId.Value } : new List<Guid>());

        List<string> assigneeNames;
        if (assigneeIds.Count > 0)
        {
            assigneeNames = await _db.Users.AsNoTracking()
                .Where(u => assigneeIds.Contains(u.Id))
                .Select(u => u.FullName ?? "?")
                .ToListAsync();
        }
        else
        {
            assigneeNames = new List<string>();
        }
        var assigneeDisplay = assigneeNames.Count > 0
            ? string.Join(", ", assigneeNames)
            : "—";

        // ─────────────────────────────────────────────────────────────────────
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
                        Row("Assigné à", assigneeDisplay);
                        Row("Sprint",    t.Sprint?.Name ?? "Backlog");
                        Row("Créé par",  createdByName);
                        Row("Créé le",   t.CreatedAt.ToString("dd/MM/yyyy HH:mm"));
                        Row("Modifié le",t.UpdatedAt.ToString("dd/MM/yyyy HH:mm"));
                        if (t.StoryPoints.HasValue)
                            Row("Story Points", t.StoryPoints.Value.ToString());
                    });

                    // ── Assignés détail (si plusieurs)
                    if (assigneeNames.Count > 1)
                    {
                        col.Item().Text("Assignés").Bold().FontSize(12).FontColor("#4f46e5");
                        col.Item().PaddingTop(4).PaddingBottom(14).Column(ac =>
                        {
                            foreach (var name in assigneeNames)
                            {
                                ac.Item().Row(r =>
                                {
                                    r.ConstantItem(10).Text("•").FontColor("#6366f1");
                                    r.RelativeItem().Text(name).FontSize(10);
                                });
                            }
                        });
                    }

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

    // PATCH /api/tasks/{id}/sprint  — move task to another sprint (or backlog)
    [HttpPatch("{id:guid}/sprint")]
    public async Task<IActionResult> ChangeSprint(Guid id, [FromBody] ChangeSprintRequest request)
    {
        var task = await _db.Tasks.FindAsync(id);
        if (task is null) return NotFound();

        task.SprintId  = request.SprintId;
        task.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { task.Id, task.SprintId });
    }

    private async Task<TaskDto> ToDto(Guid id)
    {
        var t = await _db.Tasks.AsNoTracking()
            .Include(x => x.Assignee)
            .FirstAsync(x => x.Id == id);

        var commentCount = await _db.TaskComments.CountAsync(c => c.TaskId == id);

        // Resolve names for all assignees
        var effectiveIds = t.AssigneeIds.Count > 0 ? t.AssigneeIds
                         : t.AssigneeId.HasValue    ? [t.AssigneeId.Value]
                         : new List<Guid>();

        List<string> assigneeNames = [];
        if (effectiveIds.Count > 0)
        {
            var users = await _db.Users.AsNoTracking()
                .Where(u => effectiveIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.FullName);
            assigneeNames = effectiveIds.Select(gid => users.TryGetValue(gid, out var n) ? n : "?").ToList();
        }

        return new TaskDto(
            t.Id, t.ProjectId, t.SprintId, t.Title, t.Description,
            t.Status, t.Priority, t.StoryPoints,
            t.AssigneeId, t.Assignee?.FullName,
            t.CreatedById, t.Order, t.CreatedAt, t.UpdatedAt, commentCount,
            t.Tags, t.Assignee?.PhotoUrl,
            effectiveIds, assigneeNames);
    }
}
