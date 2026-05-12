using AgentPM.Domain.Entities;

namespace AgentPM.Domain.Interfaces;

public interface ISprintRepository
{
    Task<List<Sprint>> GetByProjectAsync(Guid projectId, CancellationToken ct);
    Task<Sprint?> GetByIdAsync(Guid id, CancellationToken ct);
    Task AddAsync(Sprint sprint, CancellationToken ct);
    Task UpdateAsync(Sprint sprint, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
}