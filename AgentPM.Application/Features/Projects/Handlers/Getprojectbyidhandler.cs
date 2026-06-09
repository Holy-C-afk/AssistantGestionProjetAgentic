using AgentPM.Application.Features.Projects.DTOs;
using AgentPM.Application.Features.Projects.Queries;
using AgentPM.Domain.Interfaces;
using MediatR;

namespace AgentPM.Application.Features.Projects.Handlers;

public class GetProjectByIdHandler : IRequestHandler<GetProjectByIdQuery, ProjectDto>
{
    private readonly IProjectRepository _repo;

    public GetProjectByIdHandler(IProjectRepository repo)
    {
        _repo = repo;
    }

    public async Task<ProjectDto> Handle(GetProjectByIdQuery request, CancellationToken ct)
    {
        var aggregate = await _repo.GetByIdAsync(request.ProjectId, ct)
            ?? throw new KeyNotFoundException($"Project {request.ProjectId} not found.");

        var member = aggregate.Project.Members.FirstOrDefault(m => m.UserId == request.UserId);
        var role   = member?.Role ?? (aggregate.Project.OwnerId == request.UserId ? "admin" : "member");

        return new ProjectDto(
            aggregate.Project.Id,
            aggregate.Project.Name,
            aggregate.Project.Description,
            aggregate.Project.OwnerId,
            aggregate.Project.Status,
            aggregate.Project.CreatedAt,
            aggregate.Project.UpdatedAt,
            MemberCount: aggregate.Project.Members.Count,
            CurrentUserRole: role,
            SprintCount: aggregate.Project.Sprints.Count,
            TaskTotal: aggregate.Project.Tasks.Count,
            TaskDone: aggregate.Project.Tasks.Count(t => t.Status == "done")
        );
    }
}