using AgentPM.Application.Features.Projects.Commands;
using AgentPM.Domain.Interfaces;
using MediatR;

namespace AgentPM.Application.Features.Projects.Handlers;

public class AddMemberHandler : IRequestHandler<AddMemberCommand, Unit>
{
    private readonly IProjectRepository _repo;

    public AddMemberHandler(IProjectRepository repo)
    {
        _repo = repo;
    }

    public async Task<Unit> Handle(AddMemberCommand request, CancellationToken ct)
    {
        var aggregate = await _repo.GetByIdAsync(request.ProjectId, ct)
            ?? throw new KeyNotFoundException($"Project {request.ProjectId} not found.");

        aggregate.AddMember(request.UserId, request.Role);

        await _repo.AddMemberAsync(
            aggregate.Project.Members.Last(),
            ct
        );

        return Unit.Value;
    }
}