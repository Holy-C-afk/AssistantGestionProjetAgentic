using System;
using System.Collections.Generic;
using System.Text;

namespace AgentPM.Domain.Entities
{
    public class EventStoreEntry
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid AggregateId { get; set; }
        public string AggregateType { get; set; } = default!;
        public string EventType { get; set; } = default!;
        public string Payload { get; set; } = "{}";
        public int Version { get; set; }
        public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
        public Guid? UserId { get; set; }
    }

}
