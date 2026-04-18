using AgentPM.Application.Features.Sprints.Commands;
using AgentPM.Application.Features.Sprints.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AgentPM.Api.Controllers;

[ApiController]
[Route("api/project/{projectId:guid}/sprints")]
[Authorize]
public class SprintController : ControllerBase
{
    private readonly IMediator _mediator;
    public SprintController(IMediator mediator) => _mediator = mediator;

    // GET api/project/{projectId}/sprints
    [HttpGet]
    public async Task<IActionResult> GetSprints(Guid projectId)
    {
        var result = await _mediator.Send(new GetSprintsQuery(projectId));
        return Ok(result);
    }

    // GET api/project/{projectId}/sprints/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid projectId, Guid id)
    {
        var result = await _mediator.Send(new GetSprintByIdQuery(id));
        return Ok(result);
    }

    // POST api/project/{projectId}/sprints
    [HttpPost]
    public async Task<IActionResult> Create(Guid projectId, [FromBody] CreateSprintRequest request)
    {
        var result = await _mediator.Send(new CreateSprintCommand(
            projectId,
            request.Name,
            request.Goal,
            request.StartDate,
            request.EndDate
        ));
        return CreatedAtAction(nameof(GetById), new { projectId, id = result.Id }, result);
    }

    // POST api/project/{projectId}/sprints/{id}/close
    [HttpPost("{id:guid}/close")]
    public async Task<IActionResult> Close(Guid projectId, Guid id)
    {
        var result = await _mediator.Send(new CloseSprintCommand(id));
        return Ok(result);
    }
}

public record CreateSprintRequest(
    string Name,
    string? Goal,
    DateOnly? StartDate,
    DateOnly? EndDate
);