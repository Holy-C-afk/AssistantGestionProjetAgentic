namespace AgentPM.Application.Agent;

public record AgentResult
{
    public string? Reply { get; init; }
    public List<string>? SubTasks { get; init; }
    public int? StoryPoints { get; init; }
    public List<string>? RelatedTasks { get; init; }
}
