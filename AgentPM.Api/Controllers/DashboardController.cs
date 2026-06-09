using AgentPM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgentPM.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _db;

    public DashboardController(AppDbContext db) => _db = db;

    private Guid CurrentUserId
    {
        get
        {
            if (Request.Headers.TryGetValue("X-User-Id", out var v) && Guid.TryParse(v, out var id))
                return id;
            return Guid.Parse("b8886e34-aefb-4433-b59b-4d618fdb9e9f");
        }
    }

    // GET /api/dashboard
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var userId = CurrentUserId;

        // Projects the user is a member of (or owns)
        var projectIds = await _db.ProjectMembers
            .Where(m => m.UserId == userId)
            .Select(m => m.ProjectId)
            .ToListAsync();

        var projects = await _db.Projects
            .Where(p => projectIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Name, p.Status, p.CreatedAt, p.UpdatedAt })
            .ToListAsync();

        // Project stats
        var projectStats = new
        {
            total     = projects.Count,
            active    = projects.Count(p => p.Status == "active"),
            completed = projects.Count(p => p.Status == "completed"),
            archived  = projects.Count(p => p.Status == "archived"),
        };

        // Tasks across all user projects
        var tasks = await _db.Tasks
            .Where(t => projectIds.Contains(t.ProjectId))
            .Select(t => new { t.Status, t.CreatedAt, t.Priority })
            .ToListAsync();

        var taskStats = new
        {
            total      = tasks.Count,
            todo       = tasks.Count(t => t.Status == "todo"),
            inProgress = tasks.Count(t => t.Status == "in-progress"),
            done       = tasks.Count(t => t.Status == "done"),
        };

        // Sprint stats
        var sprintStats = await _db.Sprints
            .Where(s => projectIds.Contains(s.ProjectId))
            .GroupBy(s => s.Status)
            .Select(g => new { status = g.Key, count = g.Count() })
            .ToListAsync();

        // Monthly completions — last 6 months
        var since = DateTime.UtcNow.AddMonths(-5);
        var allTasks = await _db.Tasks
            .Where(t => projectIds.Contains(t.ProjectId) && t.UpdatedAt >= since)
            .Select(t => new { t.Status, t.UpdatedAt })
            .ToListAsync();

        var monthly = Enumerable.Range(0, 6)
            .Select(i =>
            {
                var m   = DateTime.UtcNow.AddMonths(-5 + i);
                var key = m.ToString("MMM");
                var done = allTasks.Count(t =>
                    t.Status == "done" &&
                    t.UpdatedAt.Year == m.Year &&
                    t.UpdatedAt.Month == m.Month);
                var created = tasks.Count(t =>
                    t.CreatedAt.Year == m.Year &&
                    t.CreatedAt.Month == m.Month);
                return new { month = key, done, created };
            })
            .ToList();

        // Priority distribution
        var priorities = tasks
            .GroupBy(t => t.Priority ?? "none")
            .Select(g => new { name = g.Key, value = g.Count() })
            .ToList();

        // Recent projects (last 5 updated)
        var recentProjects = projects
            .OrderByDescending(p => p.UpdatedAt)
            .Take(5)
            .Select(p => new { p.Id, p.Name, p.Status, p.UpdatedAt })
            .ToList();

        return Ok(new
        {
            projectStats,
            taskStats,
            sprintStats,
            monthly,
            priorities,
            recentProjects,
        });
    }
}
