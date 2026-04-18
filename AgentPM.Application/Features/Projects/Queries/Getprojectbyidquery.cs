using AgentPM.Application.Features.Projects.DTOs;
using MediatR;

namespace AgentPM.Application.Features.Projects.Queries;

public record GetProjectByIdQuery(Guid ProjectId, Guid UserId) : IRequest<ProjectDto>;