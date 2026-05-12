using AgentPM.Application.Agent;
using AgentPM.Application.Features.Conversations.Commands;
using AgentPM.Application.Features.Conversations.Queries;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace AgentPM.Api.Controllers;

[ApiController]
[Route("api/agent")]
public class AgentController : ControllerBase
{
    private readonly AgentOrchestrator _orchestrator;
    private readonly IMediator _mediator;

    public AgentController(AgentOrchestrator orchestrator, IMediator mediator)
    {
        _orchestrator = orchestrator;
        _mediator = mediator;
    }

    /// <summary>Reads UserId from the X-User-Id header (same as all other controllers).</summary>
    private Guid? CurrentUserId()
    {
        if (Request.Headers.TryGetValue("X-User-Id", out var v) &&
            Guid.TryParse(v, out var id))
            return id;
        return null;
    }

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

    /// <summary>Generate a narrative sprint progress report (S4-4).</summary>
    [HttpPost("report")]
    public async Task<IActionResult> Report([FromBody] AgentReportRequest req, CancellationToken ct)
    {
        var result = await _orchestrator.HandleAsync(new AgentRequest
        {
            Intent = AgentIntent.Report,
            SprintId = req.SprintId,
        }, ct);
        return Ok(new { report = result.Reply });
    }

    // ── Conversation persistence (S4-9) ──────────────────────────────────────

    [HttpPost("conversations")]
    public async Task<IActionResult> StartConversation([FromBody] StartConvRequest req, CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (!userId.HasValue) return Unauthorized();
        var conv = await _mediator.Send(new StartConversationCommand(req.ProjectId, userId.Value), ct);
        return Ok(conv);
    }

    [HttpGet("conversations/{conversationId:guid}")]
    public async Task<IActionResult> GetHistory(Guid conversationId, CancellationToken ct)
    {
        var conv = await _mediator.Send(new GetConversationHistoryQuery(conversationId), ct);
        if (conv is null) return NotFound();
        return Ok(conv);
    }

    [HttpGet("conversations/project/{projectId:guid}")]
    public async Task<IActionResult> GetProjectConversations(Guid projectId, CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (!userId.HasValue) return Unauthorized();
        var convs = await _mediator.Send(new GetProjectConversationsQuery(projectId, userId.Value), ct);
        return Ok(convs);
    }

    [HttpPost("conversations/{conversationId:guid}/messages")]
    public async Task<IActionResult> AppendMessage(
        Guid conversationId,
        [FromBody] AppendMsgRequest req,
        CancellationToken ct)
    {
        var msg = await _mediator.Send(new AppendMessageCommand(conversationId, req.Role, req.Content), ct);
        return Ok(msg);
    }
}

public record AgentChatRequest(string Message, Guid? ProjectId = null);
public record AgentDecomposeRequest(string Title, string? Description = null);
public record AgentEstimateRequest(string Title, string? Description = null);
public record AgentSearchRequest(string Query, Guid ProjectId);
public record AgentReportRequest(Guid SprintId);
public record StartConvRequest(Guid ProjectId);
public record AppendMsgRequest(string Role, string Content);
