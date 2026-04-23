using AgentPM.Domain.Entities;

namespace AgentPM.Domain.Interfaces;

public interface IVectorSearchService
{
    Task<List<TaskItem>> SearchAsync(string query, Guid projectId, int topK = 5, CancellationToken ct = default);
}
