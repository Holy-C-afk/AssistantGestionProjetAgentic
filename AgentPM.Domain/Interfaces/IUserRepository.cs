// IUserRepository.cs
using AgentPM.Domain.Entities;

namespace AgentPM.Domain.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByEmailAsync(string email, CancellationToken ct);
    Task<bool> ExistsAsync(string email, CancellationToken ct);
    Task AddAsync(User user, CancellationToken ct);

    /// <summary>Batch-loads users by their IDs. Returns empty dict when ids is empty.</summary>
    Task<Dictionary<Guid, User>> GetByIdsAsync(IEnumerable<Guid> ids, CancellationToken ct);
}