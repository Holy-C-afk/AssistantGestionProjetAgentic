using AgentPM.Application.Features.Sprints.Commands;
using AgentPM.Application.Features.Sprints.DTOs;
using AgentPM.Application.Features.Sprints.Queries;
using AgentPM.Domain.Entities;
using AgentPM.Domain.Interfaces;
using MediatR;

namespace AgentPM.Application.Features.Sprints.Handlers;

public class GetSprintsHandler : IRequestHandler<GetSprintsQuery, List<SprintDto>>
{
    private readonly ISprintRepository _repo;
    public GetSprintsHandler(ISprintRepository repo) => _repo = repo;

    public async Task<List<SprintDto>> Handle(GetSprintsQuery request, CancellationToken ct)
    {
        var sprints = await _repo.GetByProjectAsync(request.ProjectId, ct);
        return sprints.Select(ToDto).ToList();
    }

    private static SprintDto ToDto(Sprint s) => new(
        s.Id, s.ProjectId, s.Name, s.Goal,
        s.StartDate, s.EndDate, s.Status, s.Velocity,
        s.Tasks?.Count ?? 0, s.CreatedAt
    );
}

public class GetSprintByIdHandler : IRequestHandler<GetSprintByIdQuery, SprintDto>
{
    private readonly ISprintRepository _repo;
    public GetSprintByIdHandler(ISprintRepository repo) => _repo = repo;

    public async Task<SprintDto> Handle(GetSprintByIdQuery request, CancellationToken ct)
    {
        var sprint = await _repo.GetByIdAsync(request.SprintId, ct)
            ?? throw new KeyNotFoundException($"Sprint {request.SprintId} not found.");
        return ToDto(sprint);
    }

    private static SprintDto ToDto(Sprint s) => new(
        s.Id, s.ProjectId, s.Name, s.Goal,
        s.StartDate, s.EndDate, s.Status, s.Velocity,
        s.Tasks?.Count ?? 0, s.CreatedAt
    );
}

public class CreateSprintHandler : IRequestHandler<CreateSprintCommand, SprintDto>
{
    private readonly ISprintRepository _repo;
    public CreateSprintHandler(ISprintRepository repo) => _repo = repo;

    public async Task<SprintDto> Handle(CreateSprintCommand request, CancellationToken ct)
    {
        var sprint = new Sprint
        {
            ProjectId = request.ProjectId,
            Name = request.Name,
            Goal = request.Goal,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            Status = "planned"
        };

        await _repo.AddAsync(sprint, ct);

        return new SprintDto(
            sprint.Id, sprint.ProjectId, sprint.Name, sprint.Goal,
            sprint.StartDate, sprint.EndDate, sprint.Status, sprint.Velocity,
            0, sprint.CreatedAt
        );
    }
}

public class CloseSprintHandler : IRequestHandler<CloseSprintCommand, SprintDto>
{
    private readonly ISprintRepository _repo;
    public CloseSprintHandler(ISprintRepository repo) => _repo = repo;

    public async Task<SprintDto> Handle(CloseSprintCommand request, CancellationToken ct)
    {
        var sprint = await _repo.GetByIdAsync(request.SprintId, ct)
            ?? throw new KeyNotFoundException($"Sprint {request.SprintId} not found.");

        sprint.Status = "completed";
        await _repo.UpdateAsync(sprint, ct);

        return new SprintDto(
            sprint.Id, sprint.ProjectId, sprint.Name, sprint.Goal,
            sprint.StartDate, sprint.EndDate, sprint.Status, sprint.Velocity,
            sprint.Tasks?.Count ?? 0, sprint.CreatedAt
        );
    }
}