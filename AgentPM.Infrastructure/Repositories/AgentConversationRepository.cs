using AgentPM.Domain.Entities;
using AgentPM.Domain.Interfaces;
using AgentPM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AgentPM.Infrastructure.Repositories;

public class AgentConversationRepository : IAgentConversationRepository
{
    private readonly AppDbContext _db;
    public AgentConversationRepository(AppDbContext db) => _db = db;

    public async Task<AgentConversation> CreateAsync(Guid projectId, Guid userId, CancellationToken ct = default)
    {
        var conv = new AgentConversation
        {
            ProjectId = projectId,
            UserId = userId,
        };
        _db.AgentConversations.Add(conv);
        await _db.SaveChangesAsync(ct);
        return conv;
    }

    public Task<AgentConversation?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.AgentConversations
           .Include(c => c.Messages)
           .FirstOrDefaultAsync(c => c.Id == id, ct);

    public Task<List<AgentConversation>> GetByProjectUserAsync(
        Guid projectId, Guid userId, CancellationToken ct = default) =>
        _db.AgentConversations
           .Where(c => c.ProjectId == projectId && c.UserId == userId)
           .OrderByDescending(c => c.CreatedAt)
           .ToListAsync(ct);

    public async Task<AgentMessage> AddMessageAsync(
        Guid conversationId, string role, string content,
        string? toolName = null, CancellationToken ct = default)
    {
        var msg = new AgentMessage
        {
            ConversationId = conversationId,
            Role = role,
            Content = content,
            ToolName = toolName,
        };
        _db.AgentMessages.Add(msg);
        await _db.SaveChangesAsync(ct);
        return msg;
    }

    public Task<List<AgentMessage>> GetMessagesAsync(Guid conversationId, CancellationToken ct = default) =>
        _db.AgentMessages
           .Where(m => m.ConversationId == conversationId)
           .OrderBy(m => m.CreatedAt)
           .ToListAsync(ct);
}
