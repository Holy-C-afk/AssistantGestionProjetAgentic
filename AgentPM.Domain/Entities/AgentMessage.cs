using System;
using System.Collections.Generic;
using System.Text;

namespace AgentPM.Domain.Entities
{
    public class AgentMessage
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ConversationId { get; set; }
        public string Role { get; set; } = default!;
        public string? Content { get; set; }
        public string? ToolName { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public AgentConversation Conversation { get; set; } = default!;
    }

}
