using AgentPM.Application.Agent;
using AgentPM.Application.Features.Conversations.Commands;
using MediatR;
using Microsoft.AspNetCore.SignalR;

namespace AgentPM.Api.Hubs;

// No [Authorize] — the hub is open; user identity comes from the X-User-Id header
// that the frontend sends as a custom header during the HTTP negotiation handshake.
public class AgentHub : Hub
{
    private readonly AgentOrchestrator _orchestrator;
    private readonly IMediator _mediator;

    public AgentHub(AgentOrchestrator orchestrator, IMediator mediator)
    {
        _orchestrator = orchestrator;
        _mediator = mediator;
    }

    // ── Simple streaming chat (no tool loop) ─────────────────────────────────
    public async Task StreamChat(string message, string? conversationId)
    {
        var userId = GetUserId();

        // Persist user message if we have a conversation
        if (Guid.TryParse(conversationId, out var convId) && userId.HasValue)
            await _mediator.Send(new AppendMessageCommand(convId, "user", message));

        var sb = new System.Text.StringBuilder();

        await foreach (var token in _orchestrator.StreamChatAsync(message, Context.ConnectionAborted))
        {
            sb.Append(token);
            await Clients.Caller.SendAsync("ReceiveToken", token);
        }

        await Clients.Caller.SendAsync("StreamDone");

        // Persist assistant reply
        if (Guid.TryParse(conversationId, out convId) && userId.HasValue)
            await _mediator.Send(new AppendMessageCommand(convId, "assistant", sb.ToString()));
    }

    // ── ReAct loop streaming (tool_use + tokens) ─────────────────────────────
    public async Task RunAgent(string message, string? projectId, string? conversationId, string? sprintId = null)
    {
        var userId = GetUserId();
        var pid = Guid.TryParse(projectId, out var g) ? g : (Guid?)null;
        var sid = Guid.TryParse(sprintId, out var sg) ? sg : (Guid?)null;

        if (Guid.TryParse(conversationId, out var convId) && userId.HasValue)
            await _mediator.Send(new AppendMessageCommand(convId, "user", message));

        var sb = new System.Text.StringBuilder();

        await _orchestrator.RunReActAsync(message, pid, sid, async evt =>
        {
            switch (evt.Kind)
            {
                case AgentStreamEventKind.ThinkingStart:
                    await Clients.Caller.SendAsync("AgentThinking");
                    break;

                case AgentStreamEventKind.ToolCall:
                    await Clients.Caller.SendAsync("AgentToolCall",
                        new { tool = evt.ToolName, input = evt.Data });
                    break;

                case AgentStreamEventKind.ToolResult:
                    await Clients.Caller.SendAsync("AgentToolResult",
                        new { tool = evt.ToolName, result = evt.Data });
                    break;

                case AgentStreamEventKind.Token:
                    sb.Append(evt.Data);
                    await Clients.Caller.SendAsync("ReceiveToken", evt.Data);
                    break;

                case AgentStreamEventKind.Done:
                    await Clients.Caller.SendAsync("StreamDone");
                    break;

                case AgentStreamEventKind.Error:
                    await Clients.Caller.SendAsync("AgentError", evt.Data);
                    break;
            }
        }, Context.ConnectionAborted);

        if (Guid.TryParse(conversationId, out convId) && userId.HasValue && sb.Length > 0)
            await _mediator.Send(new AppendMessageCommand(convId, "assistant", sb.ToString()));
    }

    // ── Start a new conversation and return its Id ────────────────────────────
    public async Task<string> StartConversation(string projectId)
    {
        var userId = GetUserId();
        if (!userId.HasValue || !Guid.TryParse(projectId, out var pid))
            throw new HubException("Invalid project or unauthenticated.");

        var conv = await _mediator.Send(new StartConversationCommand(pid, userId.Value));
        return conv.Id.ToString();
    }

    private Guid? GetUserId()
    {
        // The frontend sets X-User-Id during the SignalR HTTP negotiation request
        if (Context.GetHttpContext()?.Request.Headers
                .TryGetValue("X-User-Id", out var v) == true &&
            Guid.TryParse(v, out var id))
            return id;
        return null;
    }
}
