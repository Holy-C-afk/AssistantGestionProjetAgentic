using AgentPM.Application.Features.Conversations.Commands;
using AgentPM.Application.Features.Conversations.DTOs;
using AgentPM.Application.Features.Conversations.Queries;
using AgentPM.Domain.Interfaces;
using MediatR;

namespace AgentPM.Application.Features.Conversations.Handlers;

public class StartConversationHandler : IRequestHandler<StartConversationCommand, ConversationDto>
{
    private readonly IAgentConversationRepository _repo;
    public StartConversationHandler(IAgentConversationRepository repo) => _repo = repo;

    public async Task<ConversationDto> Handle(StartConversationCommand request, CancellationToken ct)
    {
        var conv = await _repo.CreateAsync(request.ProjectId, request.UserId, ct);
        return new ConversationDto(conv.Id, conv.ProjectId, conv.UserId, conv.CreatedAt, []);
    }
}

public class AppendMessageHandler : IRequestHandler<AppendMessageCommand, MessageDto>
{
    private readonly IAgentConversationRepository _repo;
    public AppendMessageHandler(IAgentConversationRepository repo) => _repo = repo;

    public async Task<MessageDto> Handle(AppendMessageCommand request, CancellationToken ct)
    {
        var msg = await _repo.AddMessageAsync(
            request.ConversationId, request.Role, request.Content, request.ToolName, ct);
        return new MessageDto(msg.Id, msg.Role, msg.Content, msg.ToolName, msg.CreatedAt);
    }
}

public class GetConversationHistoryHandler : IRequestHandler<GetConversationHistoryQuery, ConversationDto?>
{
    private readonly IAgentConversationRepository _repo;
    public GetConversationHistoryHandler(IAgentConversationRepository repo) => _repo = repo;

    public async Task<ConversationDto?> Handle(GetConversationHistoryQuery request, CancellationToken ct)
    {
        var conv = await _repo.GetByIdAsync(request.ConversationId, ct);
        if (conv is null) return null;

        var messages = await _repo.GetMessagesAsync(request.ConversationId, ct);
        return new ConversationDto(
            conv.Id, conv.ProjectId, conv.UserId, conv.CreatedAt,
            messages.Select(m => new MessageDto(m.Id, m.Role, m.Content, m.ToolName, m.CreatedAt)).ToList());
    }
}

public class GetProjectConversationsHandler : IRequestHandler<GetProjectConversationsQuery, List<ConversationDto>>
{
    private readonly IAgentConversationRepository _repo;
    public GetProjectConversationsHandler(IAgentConversationRepository repo) => _repo = repo;

    public async Task<List<ConversationDto>> Handle(GetProjectConversationsQuery request, CancellationToken ct)
    {
        var convs = await _repo.GetByProjectUserAsync(request.ProjectId, request.UserId, ct);
        var result = new List<ConversationDto>();
        foreach (var conv in convs)
        {
            var messages = await _repo.GetMessagesAsync(conv.Id, ct);
            result.Add(new ConversationDto(
                conv.Id, conv.ProjectId, conv.UserId, conv.CreatedAt,
                messages.Select(m => new MessageDto(m.Id, m.Role, m.Content, m.ToolName, m.CreatedAt)).ToList()));
        }
        return result;
    }
}
