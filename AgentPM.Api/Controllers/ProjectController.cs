using AgentPM.Api.Models;
using AgentPM.Domain.Entities;
using AgentPM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;

namespace AgentPM.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProjectController : ControllerBase
{
    private readonly AppDbContext _db;

    public ProjectController(AppDbContext db) => _db = db;

    // Ensure there is a default user for operations without authentication
    private async Task<Guid> EnsureDefaultUserAsync()
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

    // GET /api/project?page=1&pageSize=10&status=active&search=foo
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        var query = _db.Projects.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(p => p.Status == status);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(p =>
                EF.Functions.ILike(p.Name, $"%{search}%") ||
                (p.Description != null && EF.Functions.ILike(p.Description, $"%{search}%")));

        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new ProjectDto(
                p.Id, p.Name, p.Description, p.Status,
                p.OwnerId, p.CreatedAt, p.Members.Count))
            .ToListAsync();

        return Ok(new PagedResult<ProjectDto>(items, total, page, pageSize));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProjectRequest request)
    {
        var ownerId = request.OwnerId ?? await EnsureDefaultUserAsync();

        var project = new Project
        {
            Name = request.Name,
            Description = request.Description,
            OwnerId = ownerId,
            Status = "active"
        };

        _db.Projects.Add(project);
        await _db.SaveChangesAsync();

        var dto = new ProjectDto(project.Id, project.Name, project.Description,
            project.Status, project.OwnerId, project.CreatedAt, 0);

        return CreatedAtAction(nameof(GetById), new { id = project.Id }, dto);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var p = await _db.Projects.AsNoTracking()
            .Include(p => p.Members)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (p is null) return NotFound();

        return Ok(new ProjectDto(p.Id, p.Name, p.Description, p.Status,
            p.OwnerId, p.CreatedAt, p.Members.Count));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProjectRequest request)
    {
        var project = await _db.Projects.FindAsync(id);
        if (project is null) return NotFound();

        project.Name = request.Name;
        project.Description = request.Description;
        if (!string.IsNullOrWhiteSpace(request.Status))
            project.Status = request.Status;

        await _db.SaveChangesAsync();

        return Ok(new ProjectDto(project.Id, project.Name, project.Description,
            project.Status, project.OwnerId, project.CreatedAt, 0));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var project = await _db.Projects.FindAsync(id);
        if (project is null) return NotFound();

        _db.Projects.Remove(project);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("{id:guid}/members")]
    public async Task<IActionResult> GetMembers(Guid id)
    {
        var members = await _db.ProjectMembers.AsNoTracking()
            .Where(m => m.ProjectId == id)
            .Include(m => m.User)
            .Select(m => new ProjectMemberDto(
                m.UserId, m.User.FullName, m.User.Email, m.Role, m.JoinedAt))
            .ToListAsync();

        return Ok(members);
    }

    [HttpPost("{id:guid}/members")]
    public async Task<IActionResult> AddMember(Guid id, [FromBody] AddMemberRequest request)
    {
        var userExists = await _db.Users.AnyAsync(u => u.Id == request.UserId);
        if (!userExists) return BadRequest(new { message = "Utilisateur introuvable." });

        var exists = await _db.ProjectMembers
            .AnyAsync(m => m.ProjectId == id && m.UserId == request.UserId);
        if (exists) return Conflict(new { message = "User is already a member." });

        var member = new ProjectMember
        {
            ProjectId = id,
            UserId = request.UserId,
            Role = request.Role
        };

        _db.ProjectMembers.Add(member);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}/members/{userId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid id, Guid userId)
    {
        var member = await _db.ProjectMembers
            .FirstOrDefaultAsync(m => m.ProjectId == id && m.UserId == userId);
        if (member is null) return NotFound();

        _db.ProjectMembers.Remove(member);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // GET /api/project/{id}/pdf
    [HttpGet("{id:guid}/pdf")]
    public async Task<IActionResult> ExportPdf(Guid id)
    {
        var project = await _db.Projects.AsNoTracking()
            .Include(p => p.Members).ThenInclude(m => m.User)
            .Include(p => p.Owner)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (project is null) return NotFound();

        var pdf = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.DefaultTextStyle(t => t.FontSize(11));

                page.Header().Column(col =>
                {
                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Text(project.Name)
                            .FontSize(24).Bold().FontColor(Colors.Indigo.Darken2);

                        row.ConstantItem(90).AlignRight()
                            .Background(project.Status == "active"
                                ? Colors.Green.Lighten4
                                : Colors.Grey.Lighten3)
                            .Padding(6)
                            .AlignCenter()
                            .Text(project.Status.ToUpperInvariant())
                            .FontSize(10).Bold()
                            .FontColor(project.Status == "active"
                                ? Colors.Green.Darken3
                                : Colors.Grey.Darken2);
                    });

                    col.Item().PaddingTop(4)
                        .Text($"Genere le {DateTime.UtcNow:dd/MM/yyyy HH:mm} UTC")
                        .FontSize(9).FontColor(Colors.Grey.Medium);

                    col.Item().PaddingTop(6).LineHorizontal(1).LineColor(Colors.Indigo.Lighten3);
                });

                page.Content().PaddingTop(20).Column(col =>
                {
                    col.Item().Text("Description").FontSize(13).Bold().FontColor(Colors.Indigo.Darken1);
                    col.Item().PaddingTop(4).PaddingBottom(16)
                        .Text(string.IsNullOrWhiteSpace(project.Description)
                            ? "Aucune description."
                            : project.Description)
                        .FontColor(Colors.Grey.Darken2);

                    col.Item().Text("Informations").FontSize(13).Bold().FontColor(Colors.Indigo.Darken1);
                    col.Item().PaddingTop(6).PaddingBottom(16).Table(table =>
                    {
                        table.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn(1);
                            c.RelativeColumn(2);
                        });

                        void InfoRow(string label, string value)
                        {
                            table.Cell().Background(Colors.Grey.Lighten4).Padding(6)
                                .Text(label).SemiBold();
                            table.Cell().Padding(6).Text(value);
                        }

                        InfoRow("Proprietaire", project.Owner?.FullName ?? "-");
                        InfoRow("Statut", project.Status);
                        InfoRow("Cree le", project.CreatedAt.ToString("dd/MM/yyyy"));
                        InfoRow("Membres", project.Members.Count.ToString());
                    });

                    col.Item().Text($"Membres ({project.Members.Count})")
                        .FontSize(13).Bold().FontColor(Colors.Indigo.Darken1);
                    col.Item().PaddingTop(6).Table(table =>
                    {
                        table.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn(3);
                            c.RelativeColumn(3);
                            c.RelativeColumn(2);
                            c.RelativeColumn(2);
                        });

                        foreach (var h in new[] { "Nom", "Email", "Role", "Depuis" })
                        {
                            table.Cell()
                                .Background(Colors.Indigo.Darken2)
                                .Padding(7)
                                .Text(h).Bold().FontColor(Colors.White);
                        }

                        var even = false;
                        foreach (var m in project.Members)
                        {
                            var bg = even ? Colors.Grey.Lighten5 : Colors.White;
                            table.Cell().Background(bg).Padding(6).Text(m.User.FullName);
                            table.Cell().Background(bg).Padding(6).Text(m.User.Email);
                            table.Cell().Background(bg).Padding(6).Text(m.Role);
                            table.Cell().Background(bg).Padding(6).Text(m.JoinedAt.ToString("dd/MM/yyyy"));
                            even = !even;
                        }

                        if (!project.Members.Any())
                        {
                            table.Cell().ColumnSpan(4).Padding(10)
                                .Text("Aucun membre.").FontColor(Colors.Grey.Medium).Italic();
                        }
                    });
                });

                page.Footer().AlignCenter()
                    .Text(t =>
                    {
                        t.Span("AgentPM - ").FontColor(Colors.Grey.Medium);
                        t.CurrentPageNumber().FontColor(Colors.Grey.Medium);
                        t.Span(" / ").FontColor(Colors.Grey.Medium);
                        t.TotalPages().FontColor(Colors.Grey.Medium);
                    });
            });
        });

        var bytes = pdf.GeneratePdf();
        var filename = $"project_{project.Name.Replace(" ", "_")}_{DateTime.UtcNow:yyyyMMdd}.pdf";
        return File(bytes, "application/pdf", filename);
    }
}
