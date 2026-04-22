using AgentPM.Application.Features.Projects.DTOs;
using AgentPM.Application.Features.Projects.Queries;
using AgentPM.Domain.Interfaces;
using MediatR;

namespace AgentPM.Application.Features.Projects.Handlers;

public class GetMyProjectsHandler : IRequestHandler<GetMyProjectsQuery, PagedResult<ProjectDto>>
{
    private readonly IProjectRepository _repo;

    public GetMyProjectsHandler(IProjectRepository repo)
    {
        _repo = repo;
    }

    public async Task<PagedResult<ProjectDto>> Handle(GetMyProjectsQuery request, CancellationToken ct)
    {
        var (items, total) = await _repo.GetByMemberPagedAsync(
            request.UserId, request.Page, request.PageSize, request.Search, request.Status, ct);

        return new PagedResult<ProjectDto>(
            items.Select(p => new ProjectDto(
                p.Id, p.Name, p.Description, p.OwnerId, p.Status, p.CreatedAt, p.Members.Count
            )).ToList(),
            total
        );
    }
}