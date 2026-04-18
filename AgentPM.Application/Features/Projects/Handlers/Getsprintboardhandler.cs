using AgentPM.Application.Features.Projects.DTOs;
using AgentPM.Application.Features.Projects.Queries;
using AgentPM.Domain.Interfaces;
using MediatR;

namespace AgentPM.Application.Features.Projects.Handlers;

public class GetSprintBoardHandler : IRequestHandler<GetSprintBoardQuery, SprintBoardDto>
{
    private readonly ISprintBoardRepository _repo;

    public GetSprintBoardHandler(ISprintBoardRepository repo)
    {
        _repo = repo;
    }

    public async Task<SprintBoardDto> Handle(GetSprintBoardQuery request, CancellationToken ct)
    {
        var sprint = await _repo.GetSprintWithTasksAsync(request.SprintId, ct)
            ?? throw new KeyNotFoundException($"Sprint {request.SprintId} not found.");

        var tasks = sprint.Tasks
            .OrderBy(t => t.Order)
            .Select(t => new BoardTaskDto(
                t.Id,
                t.Title,
                t.Status,
                t.Priority,
                t.StoryPoints,
                t.AssigneeId,
                t.Assignee?.FullName,
                t.Order
            )).ToList();

        return new SprintBoardDto(
            sprint.Id,
            sprint.Name,
            sprint.Status,
            sprint.StartDate,
            sprint.EndDate,
            tasks
        );
    }
}