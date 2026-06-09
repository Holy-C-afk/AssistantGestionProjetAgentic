using AgentPM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AgentPM.Domain.Entities;

namespace AgentPM.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;

    public AuthController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        // Identity comes from the headers the frontend sends using MSAL's account object.
        // The frontend sends X-Azure-Email and X-Azure-Name from the ID token, which is
        // always reliable. JWT validation is not performed (backend cannot reach
        // login.microsoftonline.com in this network environment).
        Request.Headers.TryGetValue("X-Azure-Email", out var headerEmail);
        Request.Headers.TryGetValue("X-Azure-Name",  out var headerName);

        var email = headerEmail.ToString().Trim();
        var name  = headerName.ToString().Trim();

        if (string.IsNullOrEmpty(email))
            return BadRequest("X-Azure-Email header is required.");

        if (string.IsNullOrWhiteSpace(name))
            name = email;

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

        if (user == null)
        {
            user = new User
            {
                Email        = email,
                FullName     = name,
                PasswordHash = string.Empty,
                Role         = "member"
            };
            _db.Users.Add(user);
        }
        else if (user.FullName != name)
        {
            user.FullName = name;
        }

        await _db.SaveChangesAsync();

        return Ok(new { user.Id, user.Email, user.FullName, user.Role });
    }

    // PATCH /api/auth/me/photo  — saves the Azure AD profile photo for the current user
    [HttpPatch("me/photo")]
    public async Task<IActionResult> SavePhoto([FromBody] SavePhotoRequest request)
    {
        Request.Headers.TryGetValue("X-User-Id", out var userIdHeader);
        if (!Guid.TryParse(userIdHeader, out var userId))
            return BadRequest("X-User-Id header missing.");

        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        user.PhotoUrl = request.PhotoUrl;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public record SavePhotoRequest(string PhotoUrl);
