using Microsoft.AspNetCore.SignalR;

namespace AgentPM.Api.Hubs;

/// <summary>
/// Each user joins a personal group named after their userId so the
/// NotificationService can target them individually.
/// No [Authorize] — identity comes from X-User-Id header (same pattern as AgentHub).
/// </summary>
public class NotificationHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var userId = GetUserId();
        if (userId.HasValue)
            await Groups.AddToGroupAsync(Context.ConnectionId, userId.Value.ToString());

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetUserId();
        if (userId.HasValue)
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId.Value.ToString());

        await base.OnDisconnectedAsync(exception);
    }

    private Guid? GetUserId()
    {
        var http = Context.GetHttpContext();

        // Custom headers are only reliably sent on the initial negotiate
        // request — native WebSocket connections cannot carry them. Fall
        // back to a query-string parameter set by the client when opening
        // the connection (see NotificationCenter.jsx).
        if (http?.Request.Headers.TryGetValue("X-User-Id", out var v) == true &&
            Guid.TryParse(v, out var id))
            return id;

        if (http?.Request.Query.TryGetValue("userId", out var q) == true &&
            Guid.TryParse(q, out var qid))
            return qid;

        return null;
    }
}
