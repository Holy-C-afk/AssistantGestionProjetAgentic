using AgentPM.Domain.Interfaces;

namespace AgentPM.Application.Tools;

public class ProjectInfoTool
{
    private readonly IProjectRepository _projectRepo;
    private readonly ISprintRepository _sprintRepo;

    public ProjectInfoTool(IProjectRepository projectRepo, ISprintRepository sprintRepo)
    {
        _projectRepo = projectRepo;
        _sprintRepo = sprintRepo;
    }

    public async Task<string> GetInfoAsync(Guid projectId, string infoType, CancellationToken ct = default)
    {
        return infoType switch
        {
            "members" => await GetMembersAsync(projectId, ct),
            "sprints" => await GetSprintsAsync(projectId, ct),
            _ => await GetSummaryAsync(projectId, ct),
        };
    }

    private async Task<string> GetMembersAsync(Guid projectId, CancellationToken ct)
    {
        var members = await _projectRepo.GetMembersAsync(projectId, ct);
        if (members.Count == 0)
            return "This project has no members.";

        var lines = members.Select(m =>
            $"- {m.User?.FullName ?? "Unknown"} <{m.User?.Email ?? ""}> (Role: {m.Role}, Joined: {m.JoinedAt:dd/MM/yyyy})");
        return $"Project members ({members.Count}):\n{string.Join("\n", lines)}";
    }

    private async Task<string> GetSprintsAsync(Guid projectId, CancellationToken ct)
    {
        var sprints = await _sprintRepo.GetByProjectAsync(projectId, ct);
        if (sprints.Count == 0)
            return "This project has no sprints.";

        var lines = sprints.Select(s =>
            $"- ID: {s.Id} | {s.Name} | Status: {s.Status} | {s.StartDate:dd/MM/yyyy} → {s.EndDate:dd/MM/yyyy} | Goal: {s.Goal ?? "N/A"}");
        return $"Project sprints ({sprints.Count}):\n{string.Join("\n", lines)}";
    }

    private async Task<string> GetSummaryAsync(Guid projectId, CancellationToken ct)
    {
        var membersTask = _projectRepo.GetMembersAsync(projectId, ct);
        var sprintsTask = _sprintRepo.GetByProjectAsync(projectId, ct);
        await Task.WhenAll(membersTask, sprintsTask);

        var members = membersTask.Result;
        var sprints = sprintsTask.Result;

        return $"Project overview: {members.Count} member(s), {sprints.Count} sprint(s).";
    }
}
