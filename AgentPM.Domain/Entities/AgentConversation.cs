using System;
using System.Collections.Generic;
using System.Text;

namespace AgentPM.Domain.Entities
{
    public class AgentConversation
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ProjectId { get; set; }
        public Guid UserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Project Project { get; set; } = default!;
        public User User { get; set; } = default!;
        public ICollection<AgentMessage> Messages { get; set; } = [];
    }

}
