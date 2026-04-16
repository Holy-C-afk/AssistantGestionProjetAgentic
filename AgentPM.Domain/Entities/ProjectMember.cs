using System;
using System.Collections.Generic;
using System.Text;

namespace AgentPM.Domain.Entities
{
    public class ProjectMember
    {
        public Guid ProjectId { get; set; }
        public Guid UserId { get; set; }
        public string Role { get; set; } = "member";
        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

        public Project Project { get; set; } = default!;
        public User User { get; set; } = default!;
    }

}
