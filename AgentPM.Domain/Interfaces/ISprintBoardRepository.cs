using AgentPM.Domain.Entities;

namespace AgentPM.Domain.Interfaces;

public interface ISprintBoardRepository
{
    Task<Sprint?> GetSprintWithTasksAsync(Guid sprintId, CancellationToken ct);
}