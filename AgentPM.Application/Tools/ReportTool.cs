using AgentPM.Domain;
using AgentPM.Domain.Interfaces;

namespace AgentPM.Application.Tools;

/// <summary>
/// S4-4 — Generates a narrative sprint progress report using the LLM.
/// </summary>
public class ReportTool
{
    private readonly ILLMClient _llmClient;
    private readonly ISprintBoardRepository _sprintRepo;

    public ReportTool(ILLMClient llmClient, ISprintBoardRepository sprintRepo)
    {
        _llmClient = llmClient;
        _sprintRepo = sprintRepo;
    }

    public async Task<string> GenerateSprintReportAsync(Guid sprintId, CancellationToken ct = default)
    {
        var sprint = await _sprintRepo.GetSprintWithTasksAsync(sprintId, ct);
        if (sprint is null)
            return "Sprint introuvable.";

        var tasks = sprint.Tasks ?? [];
        var total = tasks.Count;
        var done = tasks.Count(t => t.Status == "done");
        var inProgress = tasks.Count(t => t.Status == "in_progress");
        var toDo = tasks.Count(t => t.Status == "todo");
        var totalPoints = tasks.Sum(t => t.StoryPoints ?? 0);
        var donePoints = tasks.Where(t => t.Status == "done").Sum(t => t.StoryPoints ?? 0);

        var taskLines = string.Join("\n", tasks.Select(t =>
            $"- [{t.Status}] {t.Title} (Priority: {t.Priority}, SP: {t.StoryPoints ?? 0})"));

        var context = $"""
            Sprint: {sprint.Name}
            Goal: {sprint.Goal ?? "N/A"}
            Period: {sprint.StartDate:dd/MM/yyyy} → {sprint.EndDate:dd/MM/yyyy}
            Status: {sprint.Status}

            Progress: {done}/{total} tasks done | {donePoints}/{totalPoints} story points completed
            In Progress: {inProgress} | To Do: {toDo}

            Tasks:
            {taskLines}
            """;

        const string system = """
            You are AgentPM, an agile coach. Given sprint data, write a concise 3–5 paragraph
            progress report in French. Cover: overall progress, what is done, what is in progress,
            risks or blockers if any, and a short recommendation for the team.
            Be encouraging but honest.
            """;

        var settings = new LLMSettings(MaxTokens: 800);
        return await _llmClient.GenerateAsync(system, context, settings, ct);
    }
}
