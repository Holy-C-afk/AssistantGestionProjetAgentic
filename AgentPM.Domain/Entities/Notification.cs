namespace AgentPM.Domain.Entities;

public class Notification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Title { get; set; } = default!;
    public string Message { get; set; } = default!;
    // info | task_assigned | sprint_closed | member_added | project_completed
    public string Type { get; set; } = "info";
    public Guid? RelatedProjectId { get; set; }
    public Guid? RelatedSprintId { get; set; }
    public Guid? RelatedTaskId { get; set; }
    public bool IsRead { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = default!;
}
