using AgentPM.Application.Features.Projects.DTOs;
using AgentPM.Application.Features.Projects.Queries;
using AgentPM.Domain.Interfaces;
using MediatR;

namespace AgentPM.Application.Features.Projects.Handlers;

public class GetProjectMembersHandler : IRequestHandler<GetProjectMembersQuery, List<ProjectMemberDto>>
{
    private readonly IProjectRepository _repo;

    public GetProjectMembersHandler(IProjectRepository repo)
    {
        _repo = repo;
    }

    public async Task<List<ProjectMemberDto>> Handle(GetProjectMembersQuery request, CancellationToken ct)
    {
        var members = await _repo.GetMembersAsync(request.ProjectId, ct);

        return members.Select(m => new ProjectMemberDto(
            m.UserId,
            m.User.FullName,
            m.User.Email,
            m.Role,
            m.JoinedAt
        )).ToList();
    }
}