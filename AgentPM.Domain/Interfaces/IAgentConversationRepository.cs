using AgentPM.Domain.Entities;

namespace AgentPM.Domain.Interfaces;

public interface IAgentConversationRepository
{
    Task<AgentConversation> CreateAsync(Guid projectId, Guid userId, CancellationToken ct = default);
    Task<AgentConversation?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<AgentConversation>> GetByProjectUserAsync(Guid projectId, Guid userId, CancellationToken ct = default);
    Task<AgentMessage> AddMessageAsync(Guid conversationId, string role, string content, string? toolName = null, CancellationToken ct = default);
    Task<List<AgentMessage>> GetMessagesAsync(Guid conversationId, CancellationToken ct = default);
}
