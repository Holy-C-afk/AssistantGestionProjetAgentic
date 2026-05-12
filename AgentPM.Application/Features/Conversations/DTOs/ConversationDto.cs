namespace AgentPM.Application.Features.Conversations.DTOs;

public record ConversationDto(
    Guid Id,
    Guid ProjectId,
    Guid UserId,
    DateTime CreatedAt,
    List<MessageDto> Messages);

public record MessageDto(
    Guid Id,
    string Role,
    string? Content,
    string? ToolName,
    DateTime CreatedAt);
