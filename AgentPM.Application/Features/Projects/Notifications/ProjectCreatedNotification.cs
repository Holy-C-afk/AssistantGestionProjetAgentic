using MediatR;

namespace AgentPM.Application.Features.Projects.Notifications;

public record ProjectCreatedNotification(
    Guid ProjectId,
    string Name,
    Guid OwnerId,
    DateTime OccurredAt
) : INotification;