namespace AgentPM.Application.Features.Projects.DTOs;

public record ProjectDto(
    Guid Id,
    string Name,
    string? Description,
    Guid OwnerId,
    string Status,
    DateTime CreatedAt,
    int MemberCount
);