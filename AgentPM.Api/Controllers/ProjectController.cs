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
            .Include(p => p.Sprints).ThenInclude(s => s.Tasks)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (project is null) return NotFound();

        QuestPDF.Settings.License = LicenseType.Community;

        var taskCount = project.Sprints.SelectMany(s => s.Tasks).Count();

        var pdf = Document.Create(doc =>
        {
            doc.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.DefaultTextStyle(t => t.FontSize(11));

                page.Header().BorderBottom(1).BorderColor("#6366f1").PaddingBottom(8).Row(row =>
                {
                    row.RelativeItem().Column(c =>
                    {
                        c.Item().Text(project.Name).FontSize(22).Bold().FontColor("#1e1b4b");
                        c.Item().Text($"Statut : {project.Status}  •  Créé le {project.CreatedAt:dd/MM/yyyy}")
                            .FontSize(10).FontColor("#6b7280");
                    });
                });

                page.Content().PaddingTop(16).Column(col =>
                {
                    if (!string.IsNullOrWhiteSpace(project.Description))
                    {
                        col.Item().Text("Description").Bold().FontColor("#4f46e5");
                        col.Item().PaddingBottom(12).Text(project.Description).FontColor("#374151");
                    }

                    col.Item().Text("Résumé").Bold().FontColor("#4f46e5");
                    col.Item().PaddingBottom(12).Table(t =>
                    {
                        t.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); });
                        void Cell(string label, string val)
                        {
                            t.Cell().Padding(4).Background("#f9fafb").Text(label).Bold();
                            t.Cell().Padding(4).Text(val);
                        }
                        Cell("Membres", project.Members.Count.ToString());
                        Cell("Sprints", project.Sprints.Count.ToString());
                        Cell("Tâches totales", taskCount.ToString());
                    });

                    if (project.Members.Any())
                    {
                        col.Item().Text("Membres").Bold().FontColor("#4f46e5");
                        col.Item().PaddingBottom(12).Table(t =>
                        {
                            t.ColumnsDefinition(c => { c.RelativeColumn(2); c.RelativeColumn(2); c.RelativeColumn(); });
                            t.Header(h =>
                            {
                                h.Cell().Background("#e0e7ff").Padding(4).Text("Nom").Bold();
                                h.Cell().Background("#e0e7ff").Padding(4).Text("Email").Bold();
                                h.Cell().Background("#e0e7ff").Padding(4).Text("Rôle").Bold();
                            });
                            foreach (var m in project.Members)
                            {
                                t.Cell().Padding(4).Text(m.User?.FullName ?? "-");
                                t.Cell().Padding(4).Text(m.User?.Email ?? "-");
                                t.Cell().Padding(4).Text(m.Role);
                            }
                        });
                    }

                    if (project.Sprints.Any())
                    {
                        col.Item().Text("Sprints").Bold().FontColor("#4f46e5");
                        col.Item().Table(t =>
                        {
                            t.ColumnsDefinition(c => { c.RelativeColumn(2); c.RelativeColumn(); c.RelativeColumn(); });
                            t.Header(h =>
                            {
                                h.Cell().Background("#e0e7ff").Padding(4).Text("Sprint").Bold();
                                h.Cell().Background("#e0e7ff").Padding(4).Text("Statut").Bold();
                                h.Cell().Background("#e0e7ff").Padding(4).Text("Tâches").Bold();
                            });
                            foreach (var s in project.Sprints.OrderBy(s => s.CreatedAt))
                            {
                                t.Cell().Padding(4).Text(s.Name);
                                t.Cell().Padding(4).Text(s.Status);
                                t.Cell().Padding(4).Text(s.Tasks.Count.ToString());
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

        project.Status = request.Status;
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
        var result = await _mediator.Send(new UpdateProjectCommand(id, request.Name, request.Description));
        return Ok(result);
    }

    // POST api/project/{id}/members
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

    // DELETE api/project/{id}/members/{userId}
    [HttpDelete("{id:guid}/members/{userId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid id, Guid userId)
    {
        await _mediator.Send(new RemoveMemberCommand(id, userId));
        return NoContent();
    }
}

public record CreateProjectRequest(string Name, string? Description);
public record UpdateProjectRequest(string Name, string? Description);
public record AddMemberRequest(Guid UserId, string Role = "member");
public record UpdateStatusRequest(string Status);
