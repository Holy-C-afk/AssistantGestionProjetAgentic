using System.Text.Json;
using AgentPM.Domain;
using AgentPM.Domain.Interfaces;

namespace AgentPM.Application.Tools;

public class DecomposeTool
{
    private readonly ILLMClient _llmClient;

    public DecomposeTool(ILLMClient llmClient) => _llmClient = llmClient;

    public async Task<List<string>> DecomposeAsync(string taskTitle, string taskDescription, CancellationToken ct = default)
    {
        const string system = """
            You are an Agile coach. Decompose the given task into 3-7 focused, actionable sub-tasks.
            Return ONLY a valid JSON array of strings. No markdown, no explanation.
            Example: ["Design database schema","Implement API endpoint","Write unit tests"]
            """;

        var user = $"Task: {taskTitle}\nDescription: {taskDescription}";
        var settings = new LLMSettings(MaxTokens: 512);

        var raw = await _llmClient.GenerateAsync(system, user, settings);
        var json = ExtractJsonArray(raw);

        return JsonSerializer.Deserialize<List<string>>(json) ?? [];
    }

    private static string ExtractJsonArray(string response)
    {
        var start = response.IndexOf('[');
        var end = response.LastIndexOf(']');
        return start >= 0 && end > start ? response[start..(end + 1)] : "[]";
    }
}
