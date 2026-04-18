using AgentPM.Domain.Entities;
using AgentPM.Domain.Interfaces;
using AgentPM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AgentPM.Infrastructure.Repositories;

public class SprintBoardRepository : ISprintBoardRepository
{
    private readonly AppDbContext _db;

    public SprintBoardRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Sprint?> GetSprintWithTasksAsync(Guid sprintId, CancellationToken ct)
        => await _db.Sprints
            .Include(s => s.Tasks)
                .ThenInclude(t => t.Assignee)
            .FirstOrDefaultAsync(s => s.Id == sprintId, ct);
}