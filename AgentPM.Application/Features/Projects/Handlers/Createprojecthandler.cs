using AgentPM.Application.Features.Projects.Commands;
using AgentPM.Application.Features.Projects.DTOs;
using AgentPM.Application.Features.Projects.Notifications;
using AgentPM.Domain.Aggregates;
using AgentPM.Domain.Interfaces;
using MediatR;

namespace AgentPM.Application.Features.Projects.Handlers;

public class CreateProjectHandler : IRequestHandler<CreateProjectCommand, ProjectDto>
{
    private readonly IProjectRepository _repo;
    private readonly IMediator _mediator;

    public CreateProjectHandler(IProjectRepository repo, IMediator mediator)
    {
        _repo = repo;
        _mediator = mediator;
    }

    public async Task<ProjectDto> Handle(CreateProjectCommand request, CancellationToken ct)
    {
        var aggregate = ProjectAggregate.Create(
            request.Name,
            request.Description,
            request.OwnerId
        );

        await _repo.AddAsync(aggregate.Project, ct);

        await _mediator.Publish(new ProjectCreatedNotification(
            aggregate.Project.Id,
            aggregate.Project.Name,
            aggregate.Project.OwnerId,
            aggregate.Project.CreatedAt
        ), ct);

        return new ProjectDto(
            aggregate.Project.Id,
            aggregate.Project.Name,
            aggregate.Project.Description,
            aggregate.Project.OwnerId,
            aggregate.Project.Status,
            aggregate.Project.CreatedAt,
            0
        );
    }
}