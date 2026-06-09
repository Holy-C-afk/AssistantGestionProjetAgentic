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
        if (Context.GetHttpContext()?.Request.Headers
                .TryGetValue("X-User-Id", out var v) == true &&
            Guid.TryParse(v, out var id))
            return id;
        return null;
    }
}
