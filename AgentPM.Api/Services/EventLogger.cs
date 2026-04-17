using System.Text.Json;
using AgentPM.Domain.Entities;
using AgentPM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AgentPM.Api.Services;

public class EventLogger
{
    private readonly AppDbContext _db;

    public EventLogger(AppDbContext db) => _db = db;

    public async Task AppendAsync(
        Guid aggregateId,
        string aggregateType,
        string eventType,
        object payload,
        Guid? userId = null,
        CancellationToken ct = default)
    {
        var lastVersion = await _db.EventStores
            .Where(e => e.AggregateId == aggregateId)
            .MaxAsync(e => (int?)e.Version, ct) ?? 0;

        _db.EventStores.Add(new EventStoreEntry
        {
            AggregateId = aggregateId,
            AggregateType = aggregateType,
            EventType = eventType,
            Payload = JsonSerializer.Serialize(payload),
            Version = lastVersion + 1,
            UserId = userId,
            OccurredAt = DateTime.UtcNow
        });
    }
}
