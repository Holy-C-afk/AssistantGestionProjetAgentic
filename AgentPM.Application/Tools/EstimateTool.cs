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
            You are an Agile story-point estimator. Use the Fibonacci scale: 1, 2, 3, 5, 8, or 13.

            Scoring guide:
              1 – trivial: single-line change, rename, typo fix
              2 – simple: one small, well-understood change
              3 – straightforward: a few related changes, no unknowns
              5 – moderate: several moving parts or some uncertainty
              8 – complex: significant work, multiple components, notable uncertainty
             13 – very complex: large scope, many unknowns, or cross-cutting concerns

            When only a title is provided, base your estimate purely on the words in the title:
            infer scope from action verbs (add, create, fix, refactor, migrate…) and the noun (button, page, API, database…).
            When a description is also provided, use both title and description together.

            Respond with ONLY a single integer from the scale above. No text, no explanation.
            """;

        var hasDescription = !string.IsNullOrWhiteSpace(taskDescription);
        var user = hasDescription
            ? $"Title: {taskTitle}\nDescription: {taskDescription}"
            : $"Title: {taskTitle}";

        var settings = new LLMSettings(MaxTokens: 10);

        var result = await _llmClient.GenerateAsync(system, user, settings, ct);
        return int.TryParse(result.Trim(), out var points) ? points : 3;
    }
}
