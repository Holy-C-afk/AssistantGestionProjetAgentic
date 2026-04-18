using AgentPM.Application.Features.Projects.Commands;
using AgentPM.Domain.Interfaces;
using MediatR;

namespace AgentPM.Application.Features.Projects.Handlers;

public class RemoveMemberHandler : IRequestHandler<RemoveMemberCommand, Unit>
{
    private readonly IProjectRepository _repo;

    public RemoveMemberHandler(IProjectRepository repo)
    {
        _repo = repo;
    }

    public async Task<Unit> Handle(RemoveMemberCommand request, CancellationToken ct)
    {
        var aggregate = await _repo.GetByIdAsync(request.ProjectId, ct)
            ?? throw new KeyNotFoundException($"Project {request.ProjectId} not found.");

        aggregate.RemoveMember(request.UserId);
        await _repo.RemoveMemberAsync(request.ProjectId, request.UserId, ct);

        return Unit.Value;
    }
}