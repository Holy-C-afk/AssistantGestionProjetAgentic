using AgentPM.Application.Features.Projects.Commands;
using AgentPM.Application.Features.Projects.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AgentPM.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
//[Authorize]
public class ProjectController : ControllerBase
{
    private readonly IMediator _mediator;

    public ProjectController(IMediator mediator)
    {
        _mediator = mediator;
    }

 
    private Guid CurrentUserId =>
    Guid.Parse("b8886e34-aefb-4433-b59b-4d618fdb9e9f");
    // GET api/projects
    [HttpGet]
    public async Task<IActionResult> GetMyProjects()
    {
        var result = await _mediator.Send(new GetMyProjectsQuery(CurrentUserId));
        return Ok(result);
    }

    // GET api/projects/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _mediator.Send(new GetProjectByIdQuery(id, CurrentUserId));
        return Ok(result);
    }

    // GET api/projects/{id}/members
    [HttpGet("{id:guid}/members")]
    public async Task<IActionResult> GetMembers(Guid id)
    {
        var result = await _mediator.Send(new GetProjectMembersQuery(id));
        return Ok(result);
    }

    // GET api/projects/{id}/sprints/{sprintId}/board
    [HttpGet("{id:guid}/sprints/{sprintId:guid}/board")]
    public async Task<IActionResult> GetSprintBoard(Guid id, Guid sprintId)
    {
        var result = await _mediator.Send(new GetSprintBoardQuery(id, sprintId));
        return Ok(result);
    }

    // POST api/projects
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProjectRequest request)
    {
        var result = await _mediator.Send(new CreateProjectCommand(
            request.Name,
            request.Description,
            CurrentUserId
        ));
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    // PUT api/projects/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProjectRequest request)
    {
        var result = await _mediator.Send(new UpdateProjectCommand(
            id,
            request.Name,
            request.Description
        ));
        return Ok(result);
    }

    // POST api/projects/{id}/members
    [HttpPost("{id:guid}/members")]
    public async Task<IActionResult> AddMember(Guid id, [FromBody] AddMemberRequest request)
    {
        await _mediator.Send(new AddMemberCommand(id, request.UserId, request.Role));
        return NoContent();
    }

    // DELETE api/projects/{id}/members/{userId}
    [HttpDelete("{id:guid}/members/{userId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid id, Guid userId)
    {
        await _mediator.Send(new RemoveMemberCommand(id, userId));
        return NoContent();
    }
}

// ── Request models ────────────────────────────────────────
public record CreateProjectRequest(string Name, string? Description);
public record UpdateProjectRequest(string Name, string? Description);
public record AddMemberRequest(Guid UserId, string Role = "member");