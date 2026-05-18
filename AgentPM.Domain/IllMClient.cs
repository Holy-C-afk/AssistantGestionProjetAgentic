namespace AgentPM.Domain.Interfaces;

public interface ILLMClient
{
    /// <summary>Single-turn text generation.</summary>
    Task<string> GenerateAsync(string systemPrompt, string userPrompt, LLMSettings settings, CancellationToken ct = default);

    /// <summary>Single-turn with Anthropic tool_use. Returns stop_reason + any tool-use blocks.</summary>
    Task<LLMToolResponse> GenerateWithToolsAsync(
        string systemPrompt,
        IReadOnlyList<LLMMessage> messages,
        IReadOnlyList<LLMTool> tools,
        LLMSettings settings,
        CancellationToken ct = default);

    /// <summary>Streams text tokens as an async sequence (single-turn, no tools).</summary>
    IAsyncEnumerable<string> StreamAsync(string systemPrompt, string userPrompt, LLMSettings settings, CancellationToken ct = default);

    /// <summary>
    /// Streams the final answer using the full conversation history.
    /// Sends tool_choice=none so the model never emits tool-call markup.
    /// </summary>
    IAsyncEnumerable<string> StreamWithHistoryAsync(
        string systemPrompt,
        IReadOnlyList<LLMMessage> messages,
        IReadOnlyList<LLMTool> tools,
        LLMSettings settings,
        CancellationToken ct = default);

    /// <summary>Generates a vector embedding for the given text.</summary>
    Task<ReadOnlyMemory<float>> GetEmbeddingsAsync(string text, CancellationToken ct = default);
}

/// <summary>A conversation message passed to <see cref="ILLMClient.GenerateWithToolsAsync"/>.</summary>
public record LLMMessage(string Role, object Content);
