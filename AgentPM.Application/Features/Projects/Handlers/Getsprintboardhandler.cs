using AgentPM.Application.Features.Projects.DTOs;
using AgentPM.Application.Features.Projects.Queries;
using AgentPM.Domain.Interfaces;
using MediatR;

namespace AgentPM.Application.Features.Projects.Handlers;

public class GetSprintBoardHandler : IRequestHandler<GetSprintBoardQuery, SprintBoardDto>
{
    private readonly ISprintBoardRepository _repo;
    private readonly IUserRepository _users;

    public GetSprintBoardHandler(ISprintBoardRepository repo, IUserRepository users)
    {
        _repo  = repo;
        _users = users;
    }

    public async Task<SprintBoardDto> Handle(GetSprintBoardQuery request, CancellationToken ct)
    {
        var sprint = await _repo.GetSprintWithTasksAsync(request.SprintId, ct)
            ?? throw new KeyNotFoundException($"Sprint {request.SprintId} not found.");

        // Collect every unique assignee ID across all tasks (single + multi)
        var allIds = sprint.Tasks
            .SelectMany(t => t.AssigneeIds.Count > 0
                ? (IEnumerable<Guid>)t.AssigneeIds
                : (t.AssigneeId.HasValue ? new[] { t.AssigneeId.Value } : Array.Empty<Guid>()))
            .Distinct()
            .ToList();

        // Batch-load user info via repository (keeps Application free of Infrastructure deps)
        var userMap = await _users.GetByIdsAsync(allIds, ct);

        var priorityOrder = new Dictionary<string, int>
        {
            ["critical"] = 0, ["high"] = 1, ["medium"] = 2, ["low"] = 3
        };

        var tasks = sprint.Tasks
            .OrderBy(t => priorityOrder.TryGetValue(t.Priority, out var o) ? o : 99)
            .ThenBy(t => t.Order)
            .Select(t =>
            {
                // Effective list of assignee IDs: prefer AssigneeIds if populated
                var ids = t.AssigneeIds.Count > 0
                    ? t.AssigneeIds
                    : (t.AssigneeId.HasValue ? [t.AssigneeId.Value] : new List<Guid>());

                var names  = ids.Select(id => userMap.TryGetValue(id, out var u) ? (u.FullName ?? "?") : "?").ToList();
                var photos = ids.Select(id => userMap.TryGetValue(id, out var u) ? u.PhotoUrl : null).ToList();

                // Primary assignee (first) for backward compat
                var primaryId    = ids.FirstOrDefault();
                var primaryName  = names.FirstOrDefault();
                var primaryPhoto = primaryId != default && userMap.TryGetValue(primaryId, out var pu) ? pu.PhotoUrl : null;

                return new BoardTaskDto(
                    t.Id,
                    t.Title,
                    t.Status,
                    t.Priority,
                    t.StoryPoints,
                    primaryId == default ? (Guid?)null : primaryId,
                    primaryName,
                    t.Order,
                    t.Comments.Count,
                    t.Tags,
                    primaryPhoto,
                    ids,
                    names
                );
            }).ToList();

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
