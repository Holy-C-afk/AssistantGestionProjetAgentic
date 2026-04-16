using AgentPM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using AgentPM.Domain.Entities;

namespace AgentPM.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]

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
        var email = User.FindFirstValue("preferred_username")
                 ?? User.FindFirstValue(ClaimTypes.Email);
        var name = User.FindFirstValue("name")
                 ?? User.FindFirstValue(ClaimTypes.Name);

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

        if (user == null)
        {
            user = new User
            {
                Email = email!,
                FullName = name ?? email!,
                PasswordHash = string.Empty,
                Role = "member"
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();
        }

        return Ok(new { user.Id, user.Email, user.FullName, user.Role });
    }
}