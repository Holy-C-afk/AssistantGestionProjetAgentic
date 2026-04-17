namespace AgentPM.Api.Models;

public record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize)
{
    public int TotalPages => (int)Math.Ceiling((double)Total / PageSize);
}

public record ProjectDto(
    Guid Id,
    string Name,
    string? Description,
    string Status,
    Guid OwnerId,
    DateTime CreatedAt,
    int MemberCount);

public record ProjectMemberDto(
    Guid UserId,
    string FullName,
    string Email,
    string Role,
    DateTime JoinedAt);

public record CreateProjectRequest(string Name, string? Description, Guid? OwnerId);

public record UpdateProjectRequest(string Name, string? Description, string? Status);

public record AddMemberRequest(Guid UserId, string Role);
