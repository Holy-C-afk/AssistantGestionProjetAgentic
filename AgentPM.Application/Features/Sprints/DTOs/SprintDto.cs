namespace AgentPM.Application.Features.Sprints.DTOs;

public record SprintDto(
    Guid Id,
    Guid ProjectId,
    string Name,
    string? Goal,
    DateOnly? StartDate,
    DateOnly? EndDate,
    string Status,
    int Velocity,
    int TaskCount,
    DateTime CreatedAt
);