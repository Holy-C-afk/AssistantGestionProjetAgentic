using AgentPM.Application.Features.Projects.DTOs;
using MediatR;

namespace AgentPM.Application.Features.Projects.Queries;

public record GetMyProjectsQuery(
    Guid UserId,
    int Page = 1,
    int PageSize = 10,
    string? Search = null,
    string? Status = null
) : IRequest<PagedResult<ProjectDto>>;
