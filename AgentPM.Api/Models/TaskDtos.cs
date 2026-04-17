namespace AgentPM.Api.Models;

public record TaskDto(
    Guid Id,
    Guid ProjectId,
    Guid? SprintId,
    string Title,
    string? Description,
    string Status,
    string Priority,
    int? StoryPoints,
    Guid? AssigneeId,
    string? AssigneeName,
    Guid CreatedById,
    int Order,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    int CommentCount);

public record CreateTaskRequest(
    Guid ProjectId,
    Guid? SprintId,
    string Title,
    string? Description,
    string? Priority,
    int? StoryPoints,
    Guid? AssigneeId);

public record UpdateTaskRequest(
    string? Title,
    string? Description,
    string? Priority,
    int? StoryPoints,
    Guid? AssigneeId,
    Guid? SprintId);

public record MoveTaskRequest(string Status, int? Order);

public record TaskCommentDto(
    Guid Id,
    Guid TaskId,
    Guid AuthorId,
    string AuthorName,
    string Content,
    DateTime CreatedAt);

public record AddCommentRequest(string Content, Guid? AuthorId);
