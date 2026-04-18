using AgentPM.Application.Features.Projects.Notifications;
using AgentPM.Domain.Interfaces;
using MediatR;

namespace AgentPM.Application.Features.Projects.Handlers;

public class ProjectCreatedNotificationHandler : INotificationHandler<ProjectCreatedNotification>
{
    private readonly IProjectRepository _repo;

    public ProjectCreatedNotificationHandler(IProjectRepository repo)
    {
        _repo = repo;
    }

    public async Task Handle(ProjectCreatedNotification notification, CancellationToken ct)
    {
        // Ajouter le owner comme premier membre avec le role owner
        await _repo.AddMemberAsync(new Domain.Entities.ProjectMember
        {
            ProjectId = notification.ProjectId,
            UserId = notification.OwnerId,
            Role = "owner",
            JoinedAt = notification.OccurredAt
        }, ct);
    }
}