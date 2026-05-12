namespace AgentPM.Application.Agent;

public record AgentResult
{
    public string? Reply { get; init; }
    public List<string>? SubTasks { get; init; }
    public int? StoryPoints { get; init; }
    public List<string>? RelatedTasks { get; init; }

    /// <summary>Tools called during the ReAct loop (for transparency UI).</summary>
    public List<ToolCallEntry>? ToolCallLog { get; init; }
}

public record ToolCallEntry(string ToolName, string Input, string Output);
