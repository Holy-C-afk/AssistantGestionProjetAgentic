using MediatR;

namespace AgentPM.Application.Features.Projects.Commands;

public record AddMemberCommand(
    Guid ProjectId,
    Guid UserId,
    string Role = "member"
) : IRequest<Unit>;