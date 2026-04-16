using System;
using System.Collections.Generic;
using System.Text;

namespace AgentPM.Domain.Entities
{
    public class TaskComment
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid TaskId { get; set; }
        public Guid AuthorId { get; set; }
        public string Content { get; set; } = default!;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public TaskItem Task { get; set; } = default!;
        public User Author { get; set; } = default!;
    }

}
