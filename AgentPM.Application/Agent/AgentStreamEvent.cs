namespace AgentPM.Application.Agent;

public enum AgentStreamEventKind
{
    /// <summary>The agent is thinking / choosing a tool.</summary>
    ThinkingStart,

    /// <summary>The agent is calling a tool.</summary>
    ToolCall,

    /// <summary>Tool execution result (fed back to the LLM).</summary>
    ToolResult,

    /// <summary>A text token from the final LLM reply.</summary>
    Token,

    /// <summary>The stream is complete.</summary>
    Done,

    /// <summary>An error occurred.</summary>
    Error
}

public record AgentStreamEvent(
    AgentStreamEventKind Kind,
    string? Data = null,
    string? ToolName = null);
