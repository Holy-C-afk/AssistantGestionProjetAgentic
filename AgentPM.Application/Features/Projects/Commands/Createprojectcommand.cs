using MediatR;
using AgentPM.Application.Features.Projects.DTOs;

namespace AgentPM.Application.Features.Projects.Commands;

public record CreateProjectCommand(
    string Name,
    string? Description,
    Guid OwnerId
) : IRequest<ProjectDto>;