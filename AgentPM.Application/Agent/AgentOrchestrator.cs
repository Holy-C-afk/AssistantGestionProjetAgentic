using System.Runtime.CompilerServices;
using System.Text.Json;
using AgentPM.Application.Tools;
using AgentPM.Domain;
using AgentPM.Domain.Interfaces;

namespace AgentPM.Application.Agent;

public class AgentOrchestrator
{
    private readonly ILLMClient _llmClient;
    private readonly DecomposeTool _decompose;
    private readonly EstimateTool _estimate;
    private readonly SearchTool _search;
    private readonly ReportTool _report;

    public AgentOrchestrator(
        ILLMClient llmClient,
        DecomposeTool decompose,
        EstimateTool estimate,
        SearchTool search,
        ReportTool report)
    {
        _llmClient = llmClient;
        _decompose = decompose;
        _estimate = estimate;
        _search = search;
        _report = report;
    }

    // ── Simple intent-routing (used by REST endpoints) ───────────────────────
    public Task<AgentResult> HandleAsync(AgentRequest request, CancellationToken ct = default) =>
        request.Intent switch
        {
            AgentIntent.Decompose => DecomposeAsync(request, ct),
            AgentIntent.Estimate  => EstimateAsync(request, ct),
            AgentIntent.Search    => SearchAsync(request, ct),
            AgentIntent.Report    => ReportAsync(request, ct),
            _                     => ChatAsync(request, ct)
        };

    private async Task<AgentResult> DecomposeAsync(AgentRequest req, CancellationToken ct)
    {
        var subTasks = await _decompose.DecomposeAsync(req.TaskTitle!, req.TaskDescription ?? string.Empty, ct);
        return new AgentResult { SubTasks = subTasks };
    }

    private async Task<AgentResult> EstimateAsync(AgentRequest req, CancellationToken ct)
    {
        var points = await _estimate.EstimateAsync(req.TaskTitle!, req.TaskDescription ?? string.Empty, ct);
        return new AgentResult { StoryPoints = points };
    }

    private async Task<AgentResult> SearchAsync(AgentRequest req, CancellationToken ct)
    {
        var tasks = await _search.SearchAsync(req.UserMessage!, req.ProjectId!.Value, ct: ct);
        return new AgentResult { RelatedTasks = tasks.Select(t => t.Title).ToList() };
    }

    private async Task<AgentResult> ReportAsync(AgentRequest req, CancellationToken ct)
    {
        var report = await _report.GenerateSprintReportAsync(req.SprintId!.Value, ct);
        return new AgentResult { Reply = report };
    }

    private async Task<AgentResult> ChatAsync(AgentRequest req, CancellationToken ct)
    {
        const string system = "You are AgentPM, an AI assistant for agile project management. " +
                              "Help with sprint planning, task breakdown, estimation, and project insights.";
        var settings = new LLMSettings(MaxTokens: 1024);
        var reply = await _llmClient.GenerateAsync(system, req.UserMessage!, settings, ct);
        return new AgentResult { Reply = reply };
    }

    // ── ReAct loop (S4-7) — used by SignalR Hub for streaming ────────────────
    private static readonly IReadOnlyList<LLMTool> ReActTools = BuildTools();

    /// <summary>
    /// Runs a ReAct (Reason + Act) loop: the LLM decides which tools to call,
    /// we execute them and feed results back, then stream the final reply.
    /// </summary>
    public async Task RunReActAsync(
        string userMessage,
        Guid? projectId,
        Func<AgentStreamEvent, Task> onEvent,
        CancellationToken ct = default)
    {
        const string system = """
            You are AgentPM, an AI assistant for agile project management.
            You have access to tools: estimate_task, decompose_task, search_tasks, generate_report.
            Use them when relevant. Always reply in the same language as the user.
            """;

        var messages = new List<LLMMessage>
        {
            new("user", userMessage)
        };

        var settings = new LLMSettings(MaxTokens: 1024);
        const int maxLoops = 5;

        await onEvent(new AgentStreamEvent(AgentStreamEventKind.ThinkingStart));

        for (int loop = 0; loop < maxLoops; loop++)
        {
            var response = await _llmClient.GenerateWithToolsAsync(system, messages, ReActTools, settings, ct);

            if (response.ToolUses.Count == 0 || response.StopReason == "end_turn")
            {
                // Stream the final text token-by-token from a fresh streaming call
                // Build a short context from messages so far
                var finalUserMsg = BuildFinalUserContext(messages);
                await foreach (var token in _llmClient.StreamAsync(system, finalUserMsg, settings, ct))
                {
                    await onEvent(new AgentStreamEvent(AgentStreamEventKind.Token, token));
                }
                await onEvent(new AgentStreamEvent(AgentStreamEventKind.Done));
                return;
            }

            // Append the assistant message with proper Anthropic content-block format.
            // The API requires an array of typed blocks (text / tool_use), NOT the raw DTO.
            var assistantBlocks = new List<object>();
            if (!string.IsNullOrEmpty(response.TextContent))
                assistantBlocks.Add(new { type = "text", text = response.TextContent });
            foreach (var tu in response.ToolUses)
                assistantBlocks.Add(new { type = "tool_use", id = tu.Id, name = tu.Name, input = tu.Input });
            messages.Add(new LLMMessage("assistant", assistantBlocks));

            // Execute each requested tool and collect results
            var toolResults = new List<object>();
            foreach (var toolUse in response.ToolUses)
            {
                await onEvent(new AgentStreamEvent(AgentStreamEventKind.ToolCall,
                    toolUse.Input.ToString(), toolUse.Name));

                var result = await ExecuteToolAsync(toolUse, projectId, ct);

                await onEvent(new AgentStreamEvent(AgentStreamEventKind.ToolResult, result, toolUse.Name));

                toolResults.Add(new
                {
                    type        = "tool_result",
                    tool_use_id = toolUse.Id,
                    content     = result
                });
            }

            // Feed tool results back as a single user turn (Anthropic requirement)
            messages.Add(new LLMMessage("user", toolResults));
        }

        // Fallback if loop exhausted
        await onEvent(new AgentStreamEvent(AgentStreamEventKind.Error,
            "Trop d'itérations dans la boucle ReAct."));
        await onEvent(new AgentStreamEvent(AgentStreamEventKind.Done));
    }

    // ── Streaming chat (simple, no tool loop) ────────────────────────────────
    public async IAsyncEnumerable<string> StreamChatAsync(
        string userMessage,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        const string system = "You are AgentPM, an AI assistant for agile project management. " +
                              "Help with sprint planning, task breakdown, estimation, and project insights.";
        var settings = new LLMSettings(MaxTokens: 1024);
        await foreach (var token in _llmClient.StreamAsync(system, userMessage, settings, ct))
            yield return token;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async Task<string> ExecuteToolAsync(LLMToolUse toolUse, Guid? projectId, CancellationToken ct)
    {
        try
        {
            return toolUse.Name switch
            {
                "estimate_task" => (await _estimate.EstimateAsync(
                    toolUse.Input.GetProperty("title").GetString() ?? "",
                    toolUse.Input.TryGetProperty("description", out var d) ? d.GetString() ?? "" : "",
                    ct)).ToString(),

                "decompose_task" => string.Join(", ", await _decompose.DecomposeAsync(
                    toolUse.Input.GetProperty("title").GetString() ?? "",
                    toolUse.Input.TryGetProperty("description", out var dd) ? dd.GetString() ?? "" : "",
                    ct)),

                "search_tasks" when projectId.HasValue => string.Join(", ",
                    (await _search.SearchAsync(
                        toolUse.Input.GetProperty("query").GetString() ?? "",
                        projectId.Value, ct: ct))
                    .Select(t => t.Title)),

                "generate_report" when toolUse.Input.TryGetProperty("sprint_id", out var sid)
                    && Guid.TryParse(sid.GetString(), out var sprintId)
                    => await _report.GenerateSprintReportAsync(sprintId, ct),

                _ => "Outil non disponible ou paramètres manquants."
            };
        }
        catch (Exception ex)
        {
            return $"Erreur lors de l'exécution de {toolUse.Name}: {ex.Message}";
        }
    }

    private static string BuildFinalUserContext(List<LLMMessage> messages)
    {
        // Rebuild a plain-text prompt that includes the original user question
        // plus any tool results gathered during the ReAct loop, so the final
        // streaming call has all the facts it needs.
        var parts = new List<string>();

        foreach (var msg in messages)
        {
            if (msg.Role == "user" && msg.Content is string s && !string.IsNullOrEmpty(s))
            {
                parts.Add(s);
            }
            else if (msg.Role == "user" && msg.Content is List<object> blocks)
            {
                // Tool-result blocks — extract plain content strings
                foreach (var block in blocks)
                {
                    var json = System.Text.Json.JsonSerializer.Serialize(block);
                    using var doc = System.Text.Json.JsonDocument.Parse(json);
                    if (doc.RootElement.TryGetProperty("content", out var c))
                        parts.Add($"[Tool result]: {c.GetString()}");
                }
            }
        }

        return parts.Count > 0 ? string.Join("\n\n", parts) : "";
    }

    private static IReadOnlyList<LLMTool> BuildTools()
    {
        static JsonElement Schema(string json) =>
            JsonDocument.Parse(json).RootElement.Clone();

        return
        [
            new LLMTool("estimate_task", "Estimate story points for a task",
                Schema("""{"type":"object","properties":{"title":{"type":"string"},"description":{"type":"string"}},"required":["title"]}""")),

            new LLMTool("decompose_task", "Break a task into smaller sub-tasks",
                Schema("""{"type":"object","properties":{"title":{"type":"string"},"description":{"type":"string"}},"required":["title"]}""")),

            new LLMTool("search_tasks", "Search for similar tasks in the project using semantic search",
                Schema("""{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}""")),

            new LLMTool("generate_report", "Generate a sprint progress report",
                Schema("""{"type":"object","properties":{"sprint_id":{"type":"string","description":"UUID of the sprint"}},"required":["sprint_id"]}""")),
        ];
    }
}
