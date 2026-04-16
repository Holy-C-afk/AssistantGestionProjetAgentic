using System;
using System.Collections.Generic;
using System.Numerics;
using System.Text;
using Pgvector;

namespace AgentPM.Domain.Entities
{
    public class TaskEmbedding
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid TaskId { get; set; }
        public Pgvector.Vector Embedding { get; set; } = default!;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public TaskItem Task { get; set; } = default!;
    }

}
