using AgentPM.Domain.Aggregates;
using AgentPM.Domain.Entities;

namespace AgentPM.Domain.Interfaces;

public interface IProjectRepository
{
    Task<ProjectAggregate?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<List<Project>> GetByOwnerAsync(Guid ownerId, CancellationToken ct);
    Task<List<Project>> GetByMemberAsync(Guid userId, CancellationToken ct);
    Task<(List<Project> Items, int Total)> GetByMemberPagedAsync(Guid userId, int page, int pageSize, string? search, string? status, CancellationToken ct);
    Task<List<ProjectMember>> GetMembersAsync(Guid projectId, CancellationToken ct);
    Task AddAsync(Project project, CancellationToken ct);
    Task UpdateAsync(Project project, CancellationToken ct);
    Task AddMemberAsync(ProjectMember member, CancellationToken ct);
    Task RemoveMemberAsync(Guid projectId, Guid userId, CancellationToken ct);
}