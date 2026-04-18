using AgentPM.Application.Features.Projects.DTOs;
using MediatR;

namespace AgentPM.Application.Features.Projects.Queries;

public record GetMyProjectsQuery(Guid UserId) : IRequest<List<ProjectDto>>;