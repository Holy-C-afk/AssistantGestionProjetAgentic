using AgentPM.Application.Features.Conversations.DTOs;
using MediatR;

namespace AgentPM.Application.Features.Conversations.Queries;

public record GetConversationHistoryQuery(Guid ConversationId)
    : IRequest<ConversationDto?>;

public record GetProjectConversationsQuery(Guid ProjectId, Guid UserId)
    : IRequest<List<ConversationDto>>;
