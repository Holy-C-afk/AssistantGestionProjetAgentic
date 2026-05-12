using AgentPM.Application.Features.Conversations.DTOs;
using MediatR;

namespace AgentPM.Application.Features.Conversations.Commands;

public record StartConversationCommand(Guid ProjectId, Guid UserId)
    : IRequest<ConversationDto>;

public record AppendMessageCommand(
    Guid ConversationId,
    string Role,
    string Content,
    string? ToolName = null)
    : IRequest<MessageDto>;
