using AgentPM.Domain.Entities;
using AgentPM.Domain.Interfaces;

namespace AgentPM.Application.Tools;

public class SearchTool
{
    private readonly IVectorSearchService _vectorSearch;

    public SearchTool(IVectorSearchService vectorSearch) => _vectorSearch = vectorSearch;

    public Task<List<TaskItem>> SearchAsync(string query, Guid projectId, int topK = 5, CancellationToken ct = default)
        => _vectorSearch.SearchAsync(query, projectId, topK, ct);
}
