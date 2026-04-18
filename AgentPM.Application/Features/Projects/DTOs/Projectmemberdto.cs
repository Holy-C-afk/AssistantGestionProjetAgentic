namespace AgentPM.Application.Features.Projects.DTOs;

public record ProjectMemberDto(
    Guid UserId,
    string FullName,
    string Email,
    string Role,
    DateTime JoinedAt
);