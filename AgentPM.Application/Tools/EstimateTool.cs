using AgentPM.Domain;
using AgentPM.Domain.Interfaces;

namespace AgentPM.Application.Tools;

public class EstimateTool
{
    private readonly ILLMClient _llmClient;

    public EstimateTool(ILLMClient llmClient) => _llmClient = llmClient;

    public async Task<int> EstimateAsync(string taskTitle, string taskDescription, CancellationToken ct = default)
    {
        const string system = """
            You are an Agile estimator. Estimate story points using the Fibonacci scale: 1, 2, 3, 5, 8, or 13.
            Consider complexity, uncertainty, and effort.
            Respond with ONLY a single integer from that scale. No text, no explanation.
            """;

        var user = $"Task: {taskTitle}\nDescription: {taskDescription}";
        var settings = new LLMSettings(MaxTokens: 10);

        var result = await _llmClient.GenerateAsync(system, user, settings);
        return int.TryParse(result.Trim(), out var points) ? points : 3;
    }
}
