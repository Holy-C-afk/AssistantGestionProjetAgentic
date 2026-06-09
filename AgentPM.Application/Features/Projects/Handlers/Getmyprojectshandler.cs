using AgentPM.Application.Features.Projects.DTOs;
using AgentPM.Application.Features.Projects.Queries;
using AgentPM.Domain.Entities;
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
        (List<Project> items, int total) = await _repo.GetByMemberPagedAsync(
            request.UserId, request.Page, request.PageSize, request.Search, request.Status, ct);

        return new PagedResult<ProjectDto>(
            items.Select(p =>
            {
                var member = p.Members.FirstOrDefault(m => m.UserId == request.UserId);
                var role   = member?.Role ?? (p.OwnerId == request.UserId ? "admin" : "member");
                return new ProjectDto(
                    p.Id, p.Name, p.Description, p.OwnerId, p.Status, p.CreatedAt, p.Members.Count, role
                );
            }).ToList(),
            total
        );
    }
}