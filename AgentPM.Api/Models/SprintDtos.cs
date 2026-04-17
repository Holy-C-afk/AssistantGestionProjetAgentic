namespace AgentPM.Api.Models;

public record SprintDto(
    Guid Id,
    Guid ProjectId,
    string Name,
    string? Goal,
    string? StartDate,
    string? EndDate,
    string Status,
    int Velocity,
    DateTime CreatedAt,
    int TaskCount);

public record CreateSprintRequest(
    Guid ProjectId,
    string Name,
    string? Goal,
    string? StartDate,
    string? EndDate);

public record UpdateSprintGoalRequest(string? Goal);

public record SprintBoardDto(
    SprintDto Sprint,
    Dictionary<string, List<TaskDto>> Columns);
