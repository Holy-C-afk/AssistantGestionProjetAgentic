using AgentPM.Domain.Entities;

namespace AgentPM.Domain.Interfaces;

public interface IEmbeddingService
{
    Task UpsertEmbeddingAsync(TaskItem task, CancellationToken ct = default);
}
