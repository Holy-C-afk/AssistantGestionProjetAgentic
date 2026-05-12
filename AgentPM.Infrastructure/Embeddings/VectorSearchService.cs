using AgentPM.Domain.Entities;
using AgentPM.Domain.Interfaces;
using AgentPM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Pgvector;
using Pgvector.EntityFrameworkCore;

namespace AgentPM.Infrastructure.Embeddings;

public class VectorSearchService : IVectorSearchService
{
    private readonly ILLMClient _llmClient;
    private readonly AppDbContext _db;

    public VectorSearchService(ILLMClient llmClient, AppDbContext db)
    {
        _llmClient = llmClient;
        _db = db;
    }

    public async Task<List<TaskItem>> SearchAsync(string query, Guid projectId, int topK = 5, CancellationToken ct = default)
    {
        var memory = await _llmClient.GetEmbeddingsAsync(query, ct);
        var queryVector = new Vector(memory.ToArray());

        return await _db.TaskEmbeddings
            .Include(e => e.Task)
            .Where(e => e.Task.ProjectId == projectId)
            .OrderBy(e => e.Embedding.CosineDistance(queryVector))
            .Take(topK)
            .Select(e => e.Task)
            .ToListAsync(ct);
    }
}
