using MediatR;
using AgentPM.Application.Features.Projects.DTOs;

namespace AgentPM.Application.Features.Projects.Commands;

public record UpdateProjectCommand(
    Guid ProjectId,
    string Name,
    string? Description,
    Guid UpdatedById = default
) : IRequest<ProjectDto>;