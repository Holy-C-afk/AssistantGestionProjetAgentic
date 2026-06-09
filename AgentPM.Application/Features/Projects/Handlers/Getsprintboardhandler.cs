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

        // Priority order: critical first, then high, medium, low
        var priorityOrder = new Dictionary<string, int>
        {
            ["critical"] = 0, ["high"] = 1, ["medium"] = 2, ["low"] = 3
        };

        var tasks = sprint.Tasks
            .OrderBy(t => priorityOrder.TryGetValue(t.Priority, out var o) ? o : 99)
            .ThenBy(t => t.Order)
            .Select(t => new BoardTaskDto(
                t.Id,
                t.Title,
                t.Status,
                t.Priority,
                t.StoryPoints,
                t.AssigneeId,
                t.Assignee?.FullName,
                t.Order,
                t.Comments.Count,
                t.Tags,
                t.Assignee?.PhotoUrl
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