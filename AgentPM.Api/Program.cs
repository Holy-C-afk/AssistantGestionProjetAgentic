using AgentPM.Infrastructure.Persistence;
using AgentPM.Domain.Interfaces;
using AgentPM.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Identity.Web;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<IProjectRepository, ProjectRepository>();
builder.Services.AddScoped<ISprintRepository, SprintRepository>();
builder.Services.AddScoped<ISprintBoardRepository, SprintBoardRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();


// ── Database ──────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        o => o.UseVector()
    )
);

// ── Azure AD ──────────────────────────────────────────────
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "https://login.microsoftonline.com/d6c5bbe2-0dd0-4148-a86c-ffe8f3e95c29";
        options.Audience = "api://dbf4a5ac-a3e3-445c-b0fe-c44a997bb684";
        options.TokenValidationParameters = new()
        {
            ValidateAudience = true,
            ValidateIssuer = true,
            ValidIssuers = new[]
            {
                "https://sts.windows.net/d6c5bbe2-0dd0-4148-a86c-ffe8f3e95c29/",
                "https://login.microsoftonline.com/d6c5bbe2-0dd0-4148-a86c-ffe8f3e95c29/v2.0"
            }
        };
    });

// ── MediatR ───────────────────────────────────────────────
builder.Services.AddMediatR(cfg =>
    cfg.RegisterServicesFromAssembly(
        typeof(AgentPM.Application.AssemblyReference).Assembly));

builder.Services.AddAuthorization();
builder.Services.AddControllers();

// ── CORS ──────────────────────────────────────────────────
builder.Services.AddCors(options =>
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()));

var app = builder.Build();

app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// ── Auto-migration ────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

app.Run();