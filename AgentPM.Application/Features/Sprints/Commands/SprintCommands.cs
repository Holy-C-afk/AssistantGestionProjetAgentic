using AgentPM.Application.Features.Sprints.DTOs;
using MediatR;

namespace AgentPM.Application.Features.Sprints.Commands;

public record CreateSprintCommand(
    Guid ProjectId,
    string Name,
    string? Goal,
    DateOnly? StartDate,
    DateOnly? EndDate
) : IRequest<SprintDto>;

public record CloseSprintCommand(Guid SprintId) : IRequest<SprintDto>;