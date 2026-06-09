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
    Guid? AssigneeId,           // primary (kept for compat)
    string? AssigneeName,
    Guid CreatedById,
    int Order,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    int CommentCount,
    List<string>? Tags = null,
    string? AssigneePhotoUrl = null,
    List<Guid>? AssigneeIds = null,
    List<string>? AssigneeNames = null);

public record CreateTaskRequest(
    Guid ProjectId,
    Guid? SprintId,
    string Title,
    string? Description,
    string? Priority,
    int? StoryPoints,
    Guid? AssigneeId,
    List<string>? Tags = null,
    List<Guid>? AssigneeIds = null);

public record UpdateTaskRequest(
    string? Title,
    string? Description,
    string? Priority,
    int? StoryPoints,
    Guid? AssigneeId,
    Guid? SprintId,
    List<string>? Tags = null,
    List<Guid>? AssigneeIds = null);

public record MoveTaskRequest(string Status, int? Order);

public record TaskCommentDto(
    Guid Id,
    Guid TaskId,
    Guid AuthorId,
    string AuthorName,
    string Content,
    DateTime CreatedAt);

public record AddCommentRequest(string Content, Guid? AuthorId);
