namespace AgentPM.Domain.Events;

public record MemberAdded(
    Guid ProjectId,
    Guid UserId,
    string Role,
    DateTime OccurredAt
);