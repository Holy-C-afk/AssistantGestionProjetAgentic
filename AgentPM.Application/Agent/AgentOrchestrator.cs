using AgentPM.Application.Tools;
using AgentPM.Domain;
using AgentPM.Domain.Interfaces;

namespace AgentPM.Application.Agent;

public class AgentOrchestrator
{
    private readonly ILLMClient _llmClient;
    private readonly DecomposeTool _decompose;
    private readonly EstimateTool _estimate;
    private readonly SearchTool _search;

    public AgentOrchestrator(
        ILLMClient llmClient,
        DecomposeTool decompose,
        EstimateTool estimate,
        SearchTool search)
    {
        _llmClient = llmClient;
        _decompose = decompose;
        _estimate = estimate;
        _search = search;
    }

    public Task<AgentResult> HandleAsync(AgentRequest request, CancellationToken ct = default) =>
        request.Intent switch
        {
            AgentIntent.Decompose => DecomposeAsync(request, ct),
            AgentIntent.Estimate  => EstimateAsync(request, ct),
            AgentIntent.Search    => SearchAsync(request, ct),
            _                     => ChatAsync(request, ct)
        };

    private async Task<AgentResult> DecomposeAsync(AgentRequest req, CancellationToken ct)
    {
        var subTasks = await _decompose.DecomposeAsync(req.TaskTitle!, req.TaskDescription ?? string.Empty, ct);
        return new AgentResult { SubTasks = subTasks };
    }

    private async Task<AgentResult> EstimateAsync(AgentRequest req, CancellationToken ct)
    {
        var points = await _estimate.EstimateAsync(req.TaskTitle!, req.TaskDescription ?? string.Empty, ct);
        return new AgentResult { StoryPoints = points };
    }

    private async Task<AgentResult> SearchAsync(AgentRequest req, CancellationToken ct)
    {
        var tasks = await _search.SearchAsync(req.UserMessage!, req.ProjectId!.Value, ct: ct);
        return new AgentResult { RelatedTasks = tasks.Select(t => t.Title).ToList() };
    }

    private async Task<AgentResult> ChatAsync(AgentRequest req, CancellationToken ct)
    {
        const string system = "You are AgentPM, an AI assistant for agile project management. " +
                              "Help with sprint planning, task breakdown, estimation, and project insights.";
        var settings = new LLMSettings(MaxTokens: 1024);
        var reply = await _llmClient.GenerateAsync(system, req.UserMessage!, settings);
        return new AgentResult { Reply = reply };
    }
}
