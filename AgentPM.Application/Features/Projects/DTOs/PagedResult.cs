namespace AgentPM.Application.Features.Projects.DTOs;

public record PagedResult<T>(List<T> Items, int Total);
