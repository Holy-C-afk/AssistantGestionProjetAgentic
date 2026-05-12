using System.Text.Json;

namespace AgentPM.Domain;

/// <summary>A single tool the LLM can invoke.</summary>
public record LLMTool(
    string Name,
    string Description,
    JsonElement InputSchema);

/// <summary>A tool_use block returned by the LLM in a message.</summary>
public record LLMToolUse(
    string Id,
    string Name,
    JsonElement Input);

/// <summary>The result of calling one tool — fed back to the LLM.</summary>
public record LLMToolResult(
    string ToolUseId,
    string Content);

/// <summary>
/// Full response from <see cref="Interfaces.ILLMClient.GenerateWithToolsAsync"/>.
/// </summary>
public record LLMToolResponse(
    string? StopReason,
    string? TextContent,
    IReadOnlyList<LLMToolUse> ToolUses);
