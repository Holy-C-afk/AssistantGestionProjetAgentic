namespace AgentPM.Application.Features.Projects.DTOs;

public record ProjectDto(
    Guid Id,
    string Name,
    string? Description,
    Guid OwnerId,
    string Status,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    int MemberCount,
    string CurrentUserRole,  // role of the requesting user in this project
    int SprintCount,
    int TaskTotal,
    int TaskDone
);