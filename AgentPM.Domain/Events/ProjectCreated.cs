namespace AgentPM.Domain.Events;

public record ProjectCreated(
    Guid ProjectId,
    string Name,
    Guid OwnerId,
    DateTime OccurredAt
);