using AgentPM.Application.Features.Projects.DTOs;
using AgentPM.Application.Features.Projects.Queries;
using AgentPM.Domain.Interfaces;
using MediatR;

namespace AgentPM.Application.Features.Projects.Handlers;

public class GetMyProjectsHandler : IRequestHandler<GetMyProjectsQuery, List<ProjectDto>>
{
    private readonly IProjectRepository _repo;

    public GetMyProjectsHandler(IProjectRepository repo)
    {
        _repo = repo;
    }

    public async Task<List<ProjectDto>> Handle(GetMyProjectsQuery request, CancellationToken ct)
    {
        var projects = await _repo.GetByMemberAsync(request.UserId, ct);

        return projects.Select(p => new ProjectDto(
            p.Id,
            p.Name,
            p.Description,
            p.OwnerId,
            p.Status,
            p.CreatedAt,
            p.Members.Count
        )).ToList();
    }
}