namespace AgentPM.Application.Features.Projects.DTOs;

public record SprintBoardDto(
    Guid SprintId,
    string SprintName,
    string SprintStatus,
    DateOnly? StartDate,
    DateOnly? EndDate,
    List<BoardTaskDto> Tasks
);

public record BoardTaskDto(
    Guid Id,
    string Title,
    string Status,
    string Priority,
    int? StoryPoints,
    Guid? AssigneeId,
    string? AssigneeName,
    int Order,
    int CommentCount,
    List<string>? Tags = null,
    string? AssigneePhotoUrl = null,
    List<Guid>? AssigneeIds = null,
    List<string>? AssigneeNames = null
);
