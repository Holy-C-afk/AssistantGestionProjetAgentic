using AgentPM.Application.Features.Projects.Commands;
using AgentPM.Application.Features.Projects.DTOs;
using AgentPM.Domain.Interfaces;
using MediatR;

namespace AgentPM.Application.Features.Projects.Handlers;

public class UpdateProjectHandler : IRequestHandler<UpdateProjectCommand, ProjectDto>
{
    private readonly IProjectRepository _repo;

    public UpdateProjectHandler(IProjectRepository repo)
    {
        _repo = repo;
    }

    public async Task<ProjectDto> Handle(UpdateProjectCommand request, CancellationToken ct)
    {
        var aggregate = await _repo.GetByIdAsync(request.ProjectId, ct)
            ?? throw new KeyNotFoundException($"Project {request.ProjectId} not found.");

        aggregate.Update(request.Name, request.Description);
        await _repo.UpdateAsync(aggregate.Project, ct);

        var member = aggregate.Project.Members.FirstOrDefault(m => m.UserId == request.UpdatedById);
        var role   = member?.Role ?? (aggregate.Project.OwnerId == request.UpdatedById ? "admin" : "member");

        aggregate.Project.UpdatedAt = DateTime.UtcNow;
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