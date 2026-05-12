namespace AgentPM.Application.Agent;

public record AgentRequest
{
    public AgentIntent Intent { get; init; } = AgentIntent.Chat;
    public string? UserMessage { get; init; }
    public string? TaskTitle { get; init; }
    public string? TaskDescription { get; init; }
    public Guid? ProjectId { get; init; }
    public Guid? SprintId { get; init; }
}
