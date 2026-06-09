using System;
using System.Collections.Generic;
using System.Text;

namespace AgentPM.Domain.Entities
{
    public class TaskItem
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid? SprintId { get; set; }
        public Guid ProjectId { get; set; }
        public string Title { get; set; } = default!;
        public string? Description { get; set; }
        public string Status { get; set; } = "todo";
        public string Priority { get; set; } = "medium";
        public int? StoryPoints { get; set; }
        public Guid? AssigneeId { get; set; }
        public Guid CreatedById { get; set; }
        public int Order { get; set; } = 0;
        public List<string> Tags { get; set; } = [];
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public Project Project { get; set; } = default!;
        public Sprint? Sprint { get; set; }
        public User? Assignee { get; set; }
        public User CreatedBy { get; set; } = default!;
        public TaskEmbedding? Embedding { get; set; }
        public ICollection<TaskComment> Comments { get; set; } = [];
    }


}
