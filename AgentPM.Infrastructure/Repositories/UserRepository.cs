// UserRepository.cs
using AgentPM.Domain.Entities;
using AgentPM.Domain.Interfaces;
using AgentPM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AgentPM.Infrastructure.Repositories;

public class UserRepository : IUserRepository
{
    private readonly AppDbContext _db;

    public UserRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<User?> GetByEmailAsync(string email, CancellationToken ct)
        => await _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);

    public async Task<bool> ExistsAsync(string email, CancellationToken ct)
        => await _db.Users.AnyAsync(u => u.Email == email, ct);

    public async Task AddAsync(User user, CancellationToken ct)
    {
        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);
    }
}