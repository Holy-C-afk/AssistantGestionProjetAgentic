using AgentPM.Domain.Entities;
using AgentPM.Domain.Interfaces;
using AgentPM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AgentPM.Infrastructure.Repositories;

public class SprintRepository : ISprintRepository
{
    private readonly AppDbContext _db;
    public SprintRepository(AppDbContext db) => _db = db;

    public async Task<List<Sprint>> GetByProjectAsync(Guid projectId, CancellationToken ct)
        => await _db.Sprints
            .Include(s => s.Tasks)
            .Where(s => s.ProjectId == projectId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(ct);

    public async Task<Sprint?> GetByIdAsync(Guid id, CancellationToken ct)
        => await _db.Sprints
            .Include(s => s.Tasks)
            .FirstOrDefaultAsync(s => s.Id == id, ct);

    public async Task AddAsync(Sprint sprint, CancellationToken ct)
    {
        _db.Sprints.Add(sprint);
        await _db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(Sprint sprint, CancellationToken ct)
    {
        _db.Sprints.Update(sprint);
        await _db.SaveChangesAsync(ct);
    }
}