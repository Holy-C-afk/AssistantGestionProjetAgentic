using AgentPM.Application.Features.Projects.DTOs;
using MediatR;

namespace AgentPM.Application.Features.Projects.Queries;

public record GetProjectMembersQuery(Guid ProjectId) : IRequest<List<ProjectMemberDto>>;