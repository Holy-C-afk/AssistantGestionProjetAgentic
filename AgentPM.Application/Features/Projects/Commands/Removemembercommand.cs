using MediatR;

namespace AgentPM.Application.Features.Projects.Commands;

public record RemoveMemberCommand(
    Guid ProjectId,
    Guid UserId
) : IRequest<Unit>;