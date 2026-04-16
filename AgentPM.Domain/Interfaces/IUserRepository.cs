// IUserRepository.cs
using AgentPM.Domain.Entities;

namespace AgentPM.Domain.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByEmailAsync(string email, CancellationToken ct);
    Task<bool> ExistsAsync(string email, CancellationToken ct);
    Task AddAsync(User user, CancellationToken ct);
}