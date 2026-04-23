using AgentPM.Domain.Entities;
using AgentPM.Domain.Interfaces;
using AgentPM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Pgvector;

namespace AgentPM.Infrastructure.Embeddings;

public class EmbeddingService : IEmbeddingService
{
    private readonly ILLMClient _llmClient;
    private readonly AppDbContext _db;

    public EmbeddingService(ILLMClient llmClient, AppDbContext db)
    {
        _llmClient = llmClient;
        _db = db;
    }

    public async Task UpsertEmbeddingAsync(TaskItem task, CancellationToken ct = default)
    {
        var text = string.IsNullOrWhiteSpace(task.Description)
            ? task.Title
            : $"{task.Title}\n{task.Description}";

        var memory = await _llmClient.GetEmbeddingsAsync(text);
        var vector = new Vector(memory.ToArray());

        var existing = await _db.TaskEmbeddings
            .FirstOrDefaultAsync(e => e.TaskId == task.Id, ct);

        if (existing is null)
        {
            _db.TaskEmbeddings.Add(new TaskEmbedding
            {
                Id = Guid.NewGuid(),
                TaskId = task.Id,
                Embedding = vector,
                CreatedAt = DateTime.UtcNow
            });
        }
        else
        {
            existing.Embedding = vector;
        }

        await _db.SaveChangesAsync(ct);
    }
}
