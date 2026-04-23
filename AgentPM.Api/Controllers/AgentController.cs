using AgentPM.Application.Agent;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AgentPM.Api.Controllers;

[ApiController]
[Route("api/agent")]
[Authorize]
public class AgentController : ControllerBase
{
    private readonly AgentOrchestrator _orchestrator;

    public AgentController(AgentOrchestrator orchestrator) => _orchestrator = orchestrator;

    /// <summary>Free-form AI chat about project management.</summary>
    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] AgentChatRequest req, CancellationToken ct)
    {
        var result = await _orchestrator.HandleAsync(new AgentRequest
        {
            Intent = AgentIntent.Chat,
            UserMessage = req.Message,
            ProjectId = req.ProjectId,
        }, ct);
        return Ok(new { reply = result.Reply });
    }

    /// <summary>Decompose a task into 3-7 actionable sub-tasks.</summary>
    [HttpPost("decompose")]
    public async Task<IActionResult> Decompose([FromBody] AgentDecomposeRequest req, CancellationToken ct)
    {
        var result = await _orchestrator.HandleAsync(new AgentRequest
        {
            Intent = AgentIntent.Decompose,
            TaskTitle = req.Title,
            TaskDescription = req.Description,
        }, ct);
        return Ok(new { subTasks = result.SubTasks });
    }

    /// <summary>Estimate story points (Fibonacci: 1/2/3/5/8/13) for a task.</summary>
    [HttpPost("estimate")]
    public async Task<IActionResult> Estimate([FromBody] AgentEstimateRequest req, CancellationToken ct)
    {
        var result = await _orchestrator.HandleAsync(new AgentRequest
        {
            Intent = AgentIntent.Estimate,
            TaskTitle = req.Title,
            TaskDescription = req.Description,
        }, ct);
        return Ok(new { storyPoints = result.StoryPoints });
    }

    /// <summary>Semantic vector search for tasks similar to a natural-language query.</summary>
    [HttpPost("search")]
    public async Task<IActionResult> Search([FromBody] AgentSearchRequest req, CancellationToken ct)
    {
        var result = await _orchestrator.HandleAsync(new AgentRequest
        {
            Intent = AgentIntent.Search,
            UserMessage = req.Query,
            ProjectId = req.ProjectId,
        }, ct);
        return Ok(new { tasks = result.RelatedTasks });
    }
}

public record AgentChatRequest(string Message, Guid? ProjectId = null);
public record AgentDecomposeRequest(string Title, string? Description = null);
public record AgentEstimateRequest(string Title, string? Description = null);
public record AgentSearchRequest(string Query, Guid ProjectId);
