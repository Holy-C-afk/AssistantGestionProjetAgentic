using AgentPM.Application.Features.Projects.Commands;
using AgentPM.Application.Features.Projects.Queries;
using AgentPM.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace AgentPM.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProjectController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly AppDbContext _db;

    public ProjectController(IMediator mediator, AppDbContext db)
    {
        _mediator = mediator;
        _db = db;
    }

    private Guid CurrentUserId
    {
        get
        {
            if (Request.Headers.TryGetValue("X-User-Id", out var v) &&
                Guid.TryParse(v, out var id))
                return id;
            return Guid.Parse("b8886e34-aefb-4433-b59b-4d618fdb9e9f");
        }
    }

    // GET api/project
    [HttpGet]
    public async Task<IActionResult> GetMyProjects(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null)
    {
        var result = await _mediator.Send(new GetMyProjectsQuery(CurrentUserId, page, pageSize, search, status));
        return Ok(result);
    }

    // GET api/project/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _mediator.Send(new GetProjectByIdQuery(id, CurrentUserId));
        return Ok(result);
    }

    // GET api/project/{id}/members
    [HttpGet("{id:guid}/members")]
    public async Task<IActionResult> GetMembers(Guid id)
    {
        var result = await _mediator.Send(new GetProjectMembersQuery(id));
        return Ok(result);
    }

    // GET api/project/{id}/sprints/{sprintId}/board
    [HttpGet("{id:guid}/sprints/{sprintId:guid}/board")]
    public async Task<IActionResult> GetSprintBoard(Guid id, Guid sprintId)
    {
        var result = await _mediator.Send(new GetSprintBoardQuery(id, sprintId));
        return Ok(result);
    }

    // GET api/project/{id}/pdf
    [HttpGet("{id:guid}/pdf")]
    public async Task<IActionResult> ExportPdf(Guid id)
    {
        var project = await _db.Projects
            .Include(p => p.Members).ThenInclude(m => m.User)
            .Include(p => p.Sprints).ThenInclude(s => s.Tasks).ThenInclude(t => t.Assignee)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (project is null) return NotFound();

        QuestPDF.Settings.License = LicenseType.Community;

        // Collect all unique multi-assignee IDs across all tasks and batch-load names
        var allTasks = project.Sprints.SelectMany(s => s.Tasks).ToList();
        var multiIds = allTasks
            .Where(t => t.AssigneeIds.Count > 0)
            .SelectMany(t => t.AssigneeIds)
            .Distinct()
            .ToList();
        var userNameMap = multiIds.Count > 0
            ? await _db.Users.AsNoTracking()
                .Where(u => multiIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.FullName ?? "?")
            : new Dictionary<Guid, string>();

        // Resolve assignee display string for a task (multi-assignee aware)
        string AssigneeList(AgentPM.Domain.Entities.TaskItem t)
        {
            if (t.AssigneeIds.Count > 0)
            {
                var names = t.AssigneeIds
                    .Select(aid => userNameMap.TryGetValue(aid, out var n) ? n : "?")
                    .ToList();
                return string.Join(", ", names);
            }
            return t.Assignee?.FullName ?? "—";
        }

        // Human-readable role labels
        static string RoleLabel(string role) => role switch
        {
            "admin"  => "Chef de projet",
            "owner"  => "Chef de projet",
            "member" => "Collaborateur",
            _        => role
        };

        static string SprintStatusLabel(string s) => s switch
        {
            "planned"   => "Planifié",
            "active"    => "Actif",
            "closed"    => "Clôturé",
            "completed" => "Terminé",
            _ => s
        };

        static string PrioLabel(string p) => p switch
        {
            "critical" => "Critique", "high" => "Haute",
            "medium"   => "Moyenne",  "low"  => "Faible", _ => p
        };

        var taskCount = allTasks.Count;

        var pdf = Document.Create(doc =>
        {
            doc.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.DefaultTextStyle(x => x.FontSize(11).FontColor("#374151"));

                // ── Header
                page.Header().BorderBottom(2).BorderColor("#6366f1").PaddingBottom(8).Column(c =>
                {
                    c.Item().Text(project.Name).FontSize(22).Bold().FontColor("#1e1b4b");
                    c.Item().Text($"Statut : {project.Status}  •  Créé le {project.CreatedAt:dd/MM/yyyy}")
                        .FontSize(10).FontColor("#6b7280");
                });

                page.Content().PaddingTop(16).Column(col =>
                {
                    // ── Description
                    if (!string.IsNullOrWhiteSpace(project.Description))
                    {
                        col.Item().Text("Description").Bold().FontColor("#4f46e5");
                        col.Item().PaddingBottom(12).Background("#f8fafc").Padding(8)
                            .Text(project.Description).FontColor("#374151");
                    }

                    // ── Résumé
                    col.Item().Text("Résumé").Bold().FontColor("#4f46e5");
                    col.Item().PaddingBottom(12).Table(t =>
                    {
                        t.ColumnsDefinition(c => { c.RelativeColumn(3); c.RelativeColumn(); });
                        void Cell(string label, string val)
                        {
                            t.Cell().Padding(5).Background("#f9fafb").Text(label).Bold().FontSize(10);
                            t.Cell().Padding(5).Text(val).FontSize(10);
                        }
                        Cell("Membres", project.Members.Count.ToString());
                        Cell("Sprints", project.Sprints.Count.ToString());
                        Cell("Tâches totales", taskCount.ToString());
                    });

                    // ── Membres
                    if (project.Members.Any())
                    {
                        col.Item().Text("Membres").Bold().FontColor("#4f46e5");
                        col.Item().PaddingBottom(14).Table(t =>
                        {
                            t.ColumnsDefinition(c => { c.RelativeColumn(2); c.RelativeColumn(2); c.RelativeColumn(1.2f); });
                            t.Header(h =>
                            {
                                h.Cell().Background("#e0e7ff").Padding(5).Text("Nom").Bold().FontSize(10);
                                h.Cell().Background("#e0e7ff").Padding(5).Text("Email").Bold().FontSize(10);
                                h.Cell().Background("#e0e7ff").Padding(5).Text("Rôle").Bold().FontSize(10);
                            });
                            foreach (var m in project.Members.OrderBy(m => m.Role))
                            {
                                t.Cell().Padding(5).Text(m.User?.FullName ?? "-").FontSize(10);
                                t.Cell().Padding(5).Text(m.User?.Email ?? "-").FontSize(10);
                                t.Cell().Padding(5).Text(RoleLabel(m.Role)).FontSize(10);
                            }
                        });
                    }

                    // ── Sprints + Tâches détaillées
                    if (project.Sprints.Any())
                    {
                        col.Item().Text("Sprints & Tâches").Bold().FontColor("#4f46e5");
                        col.Item().PaddingTop(4).Column(spCol =>
                        {
                            foreach (var sprint in project.Sprints.OrderBy(s => s.CreatedAt))
                            {
                                // Sprint sub-header
                                spCol.Item().PaddingTop(8).Row(r =>
                                {
                                    r.RelativeItem().Background("#e0e7ff").Padding(5).Text(txt =>
                                    {
                                        txt.Span(sprint.Name).Bold().FontSize(11).FontColor("#3730a3");
                                        txt.Span($"  —  {SprintStatusLabel(sprint.Status)}")
                                           .FontSize(10).FontColor("#6366f1");
                                        if (sprint.StartDate.HasValue && sprint.EndDate.HasValue)
                                            txt.Span($"  ({sprint.StartDate:dd/MM/yyyy} → {sprint.EndDate:dd/MM/yyyy})")
                                               .FontSize(9).FontColor("#9ca3af");
                                    });
                                });

                                if (!sprint.Tasks.Any())
                                {
                                    spCol.Item().PaddingLeft(8).PaddingBottom(4)
                                        .Text("Aucune tâche").FontSize(9).Italic().FontColor("#9ca3af");
                                    continue;
                                }

                                // Tasks table for this sprint
                                spCol.Item().PaddingBottom(6).Table(t =>
                                {
                                    t.ColumnsDefinition(c =>
                                    {
                                        c.RelativeColumn(2.5f); // Titre
                                        c.RelativeColumn(3);    // Description
                                        c.RelativeColumn(2);    // Assignés
                                        c.RelativeColumn(1);    // Priorité
                                    });
                                    t.Header(h =>
                                    {
                                        h.Cell().Background("#f3f4f6").Padding(4).Text("Tâche").Bold().FontSize(9);
                                        h.Cell().Background("#f3f4f6").Padding(4).Text("Description").Bold().FontSize(9);
                                        h.Cell().Background("#f3f4f6").Padding(4).Text("Assignés").Bold().FontSize(9);
                                        h.Cell().Background("#f3f4f6").Padding(4).Text("Priorité").Bold().FontSize(9);
                                    });
                                    foreach (var task in sprint.Tasks.OrderBy(x => x.Order))
                                    {
                                        t.Cell().Padding(4).Text(task.Title).FontSize(9);
                                        t.Cell().Padding(4).Text(
                                            !string.IsNullOrWhiteSpace(task.Description)
                                                ? (task.Description.Length > 120 ? task.Description[..120] + "…" : task.Description)
                                                : "—"
                                        ).FontSize(8).FontColor("#6b7280");
                                        t.Cell().Padding(4).Text(AssigneeList(task)).FontSize(9);
                                        t.Cell().Padding(4).Text(PrioLabel(task.Priority)).FontSize(9);
                                    }
                                });
                            }
                        });
                    }
                });

                page.Footer().AlignCenter().Text(t =>
                {
                    t.Span("Généré par AgentPM • ").FontColor("#9ca3af");
                    t.Span(DateTime.Now.ToString("dd/MM/yyyy HH:mm")).FontColor("#9ca3af");
                });
            });
        }).GeneratePdf();

        return File(pdf, "application/pdf", $"{project.Name}.pdf");
    }

    // PATCH api/project/{id}/status
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusRequest request)
    {
        var allowed = new[] { "active", "archived", "completed" };
        if (!allowed.Contains(request.Status))
            return BadRequest(new { message = "Statut invalide." });

        var project = await _db.Projects.FindAsync(id);
        if (project is null) return NotFound();

        project.Status    = request.Status;
        project.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { project.Id, project.Status });
    }

    // POST api/project
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProjectRequest request)
    {
        var result = await _mediator.Send(new CreateProjectCommand(request.Name, request.Description, CurrentUserId));
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    // PUT api/project/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProjectRequest request)
    {
        var result = await _mediator.Send(new UpdateProjectCommand(id, request.Name, request.Description, CurrentUserId));
        return Ok(result);
    }

    // POST api/project/{id}/members  (by userId — kept for internal use)
    [HttpPost("{id:guid}/members")]
    public async Task<IActionResult> AddMember(Guid id, [FromBody] AddMemberRequest request)
    {
        var userExists = await _db.Users.AnyAsync(u => u.Id == request.UserId);
        if (!userExists)
            return NotFound(new { message = "Utilisateur introuvable." });

        try
        {
            await _mediator.Send(new AddMemberCommand(id, request.UserId, request.Role));
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // POST api/project/{id}/members/by-email  (add member by Azure email)
    [HttpPost("{id:guid}/members/by-email")]
    public async Task<IActionResult> AddMemberByEmail(Guid id, [FromBody] AddMemberByEmailRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new { message = "L'adresse email est requise." });

        // Find the user by their Azure-registered email (case-insensitive)
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.Trim().ToLower());

        if (user is null)
            return NotFound(new
            {
                message = $"Aucun compte AgentPM pour « {request.Email} ». " +
                          "Demandez à cet utilisateur de se connecter une première fois afin que son compte soit créé."
            });

        // Check duplicate membership
        var alreadyMember = await _db.ProjectMembers
            .AnyAsync(m => m.ProjectId == id && m.UserId == user.Id);
        if (alreadyMember)
            return Conflict(new { message = "Cet utilisateur est déjà membre du projet." });

        try
        {
            await _mediator.Send(new AddMemberCommand(id, user.Id, request.Role));
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // DELETE api/project/{id}/members/{userId}
    [HttpDelete("{id:guid}/members/{userId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid id, Guid userId)
    {
        await _mediator.Send(new RemoveMemberCommand(id, userId));
        return NoContent();
    }

    // DELETE api/project/{id}  — chef de projet (admin/owner) only
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteProject(Guid id)
    {
        var project = await _db.Projects
            .Include(p => p.Members)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (project is null) return NotFound(new { message = "Projet introuvable." });

        // Only admin/owner members (or the project owner) can delete
        var member = project.Members.FirstOrDefault(m => m.UserId == CurrentUserId);
        var isAdmin = member?.Role is "admin" or "owner" || project.OwnerId == CurrentUserId;
        if (!isAdmin)
            return Forbid();

        // Cascade: delete sprints → tasks → comments (EF cascade or manual)
        var sprintIds = await _db.Sprints
            .Where(s => s.ProjectId == id)
            .Select(s => s.Id)
            .ToListAsync();

        var taskIds = await _db.Tasks
            .Where(t => t.ProjectId == id)
            .Select(t => t.Id)
            .ToListAsync();

        if (taskIds.Any())
        {
            await _db.TaskComments.Where(c => taskIds.Contains(c.TaskId)).ExecuteDeleteAsync();
            await _db.Tasks.Where(t => taskIds.Contains(t.Id)).ExecuteDeleteAsync();
        }

        if (sprintIds.Any())
            await _db.Sprints.Where(s => sprintIds.Contains(s.Id)).ExecuteDeleteAsync();

        await _db.ProjectMembers.Where(m => m.ProjectId == id).ExecuteDeleteAsync();
        await _db.Projects.Where(p => p.Id == id).ExecuteDeleteAsync();

        return Ok(new { success = true });
    }
}

public record CreateProjectRequest(string Name, string? Description);
public record UpdateProjectRequest(string Name, string? Description);
public record AddMemberRequest(Guid UserId, string Role = "member");
public record AddMemberByEmailRequest(string Email, string Role = "member");
public record UpdateStatusRequest(string Status);
