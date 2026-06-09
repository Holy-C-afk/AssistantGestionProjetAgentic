using AgentPM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgentPM.Api.Controllers;

[ApiController]
[Route("api/notifications")]
public class NotificationController : ControllerBase
{
    private readonly AppDbContext _db;

    public NotificationController(AppDbContext db) => _db = db;

    private Guid CurrentUserId
    {
        get
        {
            if (Request.Headers.TryGetValue("X-User-Id", out var v) && Guid.TryParse(v, out var id))
                return id;
            return Guid.Parse("b8886e34-aefb-4433-b59b-4d618fdb9e9f");
        }
    }

    // GET /api/notifications?unreadOnly=true
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool unreadOnly = false)
    {
        var query = _db.Notifications
            .Where(n => n.UserId == CurrentUserId);

        if (unreadOnly)
            query = query.Where(n => !n.IsRead);

        var items = await query
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .Select(n => new
            {
                n.Id, n.Title, n.Message, n.Type,
                n.RelatedProjectId, n.RelatedSprintId, n.RelatedTaskId,
                n.IsRead, n.CreatedAt,
            })
            .ToListAsync();

        var unreadCount = await _db.Notifications
            .CountAsync(n => n.UserId == CurrentUserId && !n.IsRead);

        return Ok(new { items, unreadCount });
    }

    // PATCH /api/notifications/{id}/read
    [HttpPatch("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        var n = await _db.Notifications.FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId);
        if (n is null) return NotFound();
        n.IsRead = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // PATCH /api/notifications/read-all
    [HttpPatch("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        await _db.Notifications
            .Where(n => n.UserId == CurrentUserId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));
        return NoContent();
    }

    // DELETE /api/notifications/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _db.Notifications
            .Where(n => n.Id == id && n.UserId == CurrentUserId)
            .ExecuteDeleteAsync();
        return NoContent();
    }
}
