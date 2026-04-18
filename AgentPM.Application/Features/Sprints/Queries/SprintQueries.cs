using AgentPM.Application.Features.Sprints.DTOs;
using MediatR;

namespace AgentPM.Application.Features.Sprints.Queries;

public record GetSprintsQuery(Guid ProjectId) : IRequest<List<SprintDto>>;
public record GetSprintByIdQuery(Guid SprintId) : IRequest<SprintDto>;