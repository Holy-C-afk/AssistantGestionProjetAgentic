using AgentPM.Domain.Aggregates;
using AgentPM.Domain.Entities;
using AgentPM.Domain.Interfaces;
using AgentPM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AgentPM.Infrastructure.Repositories;

public class ProjectRepository : IProjectRepository
{
    private readonly AppDbContext _db;

    public ProjectRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<ProjectAggregate?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var project = await _db.Projects
            .Include(p => p.Members)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        return project is null ? null : ProjectAggregate.Load(project);
    }

    public async Task<List<Project>> GetByOwnerAsync(Guid ownerId, CancellationToken ct)
        => await _db.Projects
            .Where(p => p.OwnerId == ownerId && p.Status != "deleted")
            .ToListAsync(ct);

    public async Task<List<Project>> GetByMemberAsync(Guid userId, CancellationToken ct)
        => await _db.Projects
            .Include(p => p.Members)
            .Where(p =>
                (p.OwnerId == userId || p.Members.Any(m => m.UserId == userId))
                && p.Status != "deleted")
            .ToListAsync(ct);

    public async Task<(List<Project> Items, int Total)> GetByMemberPagedAsync(
        Guid userId, int page, int pageSize, string? search, string? status, CancellationToken ct)
    {
        var query = _db.Projects
            .Include(p => p.Members)
            .Where(p =>
                (p.OwnerId == userId || p.Members.Any(m => m.UserId == userId))
                && p.Status != "deleted");

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(p => EF.Functions.ILike(p.Name, $"%{search}%"));

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(p => p.Status == status);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<List<ProjectMember>> GetMembersAsync(Guid projectId, CancellationToken ct)
        => await _db.ProjectMembers
            .Include(m => m.User)
            .Where(m => m.ProjectId == projectId)
            .ToListAsync(ct);

    public async Task AddAsync(Project project, CancellationToken ct)
    {
        _db.Projects.Add(project);
        await _db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(Project project, CancellationToken ct)
    {
        _db.Projects.Update(project);
        await _db.SaveChangesAsync(ct);
    }

    public async Task AddMemberAsync(ProjectMember member, CancellationToken ct)
    {
        _db.ProjectMembers.Add(member);
        await _db.SaveChangesAsync(ct);
    }

    public async Task RemoveMemberAsync(Guid projectId, Guid userId, CancellationToken ct)
    {
        var member = await _db.ProjectMembers
            .FirstOrDefaultAsync(m => m.ProjectId == projectId && m.UserId == userId, ct);

        if (member is not null)
        {
            _db.ProjectMembers.Remove(member);
            await _db.SaveChangesAsync(ct);
        }
    }
}