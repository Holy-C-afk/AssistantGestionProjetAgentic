using AgentPM.Domain.Entities;
using AgentPM.Infrastructure.Persistence;
using Microsoft.AspNetCore.SignalR;
using AgentPM.Api.Hubs;

namespace AgentPM.Api.Services;

/// <summary>
/// Creates a DB notification and pushes it in real-time via SignalR.
/// The caller must NOT call SaveChangesAsync separately — this service
/// saves on its own scope so it never conflicts with outer transactions.
/// </summary>
public class NotificationService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<NotificationHub> _hub;

    public NotificationService(IServiceScopeFactory scopeFactory, IHubContext<NotificationHub> hub)
    {
        _scopeFactory = scopeFactory;
        _hub          = hub;
    }

    public async Task SendAsync(
        Guid userId,
        string title,
        string message,
        string type = "info",
        Guid? projectId = null,
        Guid? sprintId  = null,
        Guid? taskId    = null)
    {
        var notification = new Notification
        {
            UserId           = userId,
            Title            = title,
            Message          = message,
            Type             = type,
            RelatedProjectId = projectId,
            RelatedSprintId  = sprintId,
            RelatedTaskId    = taskId,
        };

        // Persist on a fresh scope to avoid concurrency issues
        await using (var scope = _scopeFactory.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Notifications.Add(notification);
            await db.SaveChangesAsync();
        }

        // Push to the target user's SignalR group
        await _hub.Clients.Group(userId.ToString())
            .SendAsync("ReceiveNotification", new
            {
                id        = notification.Id,
                title     = notification.Title,
                message   = notification.Message,
                type      = notification.Type,
                projectId = notification.RelatedProjectId,
                sprintId  = notification.RelatedSprintId,
                taskId    = notification.RelatedTaskId,
                isRead    = false,
                createdAt = notification.CreatedAt,
            });
    }

    /// <summary>Notify all members of a project (except the actor).</summary>
    public async Task BroadcastToProjectAsync(
        IEnumerable<Guid> memberIds,
        Guid actorId,
        string title,
        string message,
        string type,
        Guid? projectId = null,
        Guid? sprintId  = null,
        Guid? taskId    = null)
    {
        foreach (var uid in memberIds.Where(id => id != actorId))
            await SendAsync(uid, title, message, type, projectId, sprintId, taskId);
    }
}
