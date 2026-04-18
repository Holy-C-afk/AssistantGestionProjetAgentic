using AgentPM.Application.Features.Projects.DTOs;
using MediatR;

namespace AgentPM.Application.Features.Projects.Queries;

public record GetSprintBoardQuery(Guid ProjectId, Guid SprintId) : IRequest<SprintBoardDto>;