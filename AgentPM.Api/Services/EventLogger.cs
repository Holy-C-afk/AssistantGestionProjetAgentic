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
        // Read max version already persisted in the DB…
        var dbMax = await _db.EventStores
            .Where(e => e.AggregateId == aggregateId)
            .MaxAsync(e => (int?)e.Version, ct) ?? 0;

        // …and also check entries that are tracked locally but not yet saved.
        // Without this, two AppendAsync calls within the same request (before
        // SaveChangesAsync) both see dbMax = 0 and both try to insert version 1
        // → PostgreSQL unique-constraint violation 23505.
        var localMax = _db.EventStores.Local
            .Where(e => e.AggregateId == aggregateId)
            .Select(e => (int?)e.Version)
            .DefaultIfEmpty(0)
            .Max() ?? 0;

        var nextVersion = Math.Max(dbMax, localMax) + 1;

        _db.EventStores.Add(new EventStoreEntry
        {
            AggregateId   = aggregateId,
            AggregateType = aggregateType,
            EventType     = eventType,
            Payload       = JsonSerializer.Serialize(payload),
            Version       = nextVersion,
            UserId        = userId,
            OccurredAt    = DateTime.UtcNow
        });
    }
}
