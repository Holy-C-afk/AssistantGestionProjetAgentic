using System;
using System.Collections.Generic;
using System.Text;

namespace AgentPM.Domain.Entities
{
    public class Project
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = default!;
        public string? Description { get; set; }
        public Guid OwnerId { get; set; }
        public string Status { get; set; } = "active";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public User Owner { get; set; } = default!;
        public ICollection<ProjectMember> Members { get; set; } = [];
        public ICollection<Sprint> Sprints { get; set; } = [];
        public ICollection<TaskItem> Tasks { get; set; } = [];
        public ICollection<AgentConversation> AgentConversations { get; set; } = [];
    }
}
