using AgentPM.Api.Hubs;
using AgentPM.Api.Services;
using AgentPM.Application.Agent;
using AgentPM.Application.Tools;
using AgentPM.Domain.Interfaces;
using AgentPM.Infrastructure.Embeddings;
using AgentPM.Infrastructure.LLM;
using AgentPM.Infrastructure.Persistence;
using AgentPM.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

// ── Repositories ──────────────────────────────────────────
builder.Services.AddScoped<IProjectRepository, ProjectRepository>();
builder.Services.AddScoped<ISprintRepository, SprintRepository>();
builder.Services.AddScoped<ISprintBoardRepository, SprintBoardRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<EventLogger>();

// ── Database ──────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        o => o.UseVector()
    )
);

// ── Azure AD auth is handled by the frontend (MSAL).
// The backend trusts the X-User-Id and X-Azure-Email headers sent by the
// authenticated frontend. JWT validation is omitted because the backend
// cannot reach login.microsoftonline.com from this network environment.
// ─────────────────────────────────────────────────────────────────────

// ── MediatR ───────────────────────────────────────────────
builder.Services.AddMediatR(cfg =>
    cfg.RegisterServicesFromAssembly(
        typeof(AgentPM.Application.AssemblyReference).Assembly));

// ── LLM / AI ─────────────────────────────────────────────
builder.Services.Configure<AnthropicOptions>(
    builder.Configuration.GetSection("Anthropic"));

builder.Services.AddHttpClient("Anthropic", (sp, client) =>
{
    var opts = sp.GetRequiredService<IOptions<AnthropicOptions>>().Value;
    client.BaseAddress = new Uri(opts.BaseUrl);
    client.DefaultRequestHeaders.Add("x-api-key", opts.ApiKey);
    client.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");
    client.Timeout = TimeSpan.FromSeconds(60);
});

builder.Services.AddHttpClient("Voyage", (sp, client) =>
{
    var opts = sp.GetRequiredService<IOptions<AnthropicOptions>>().Value;
    client.BaseAddress = new Uri("https://api.voyageai.com");
    client.DefaultRequestHeaders.Add("Authorization", $"Bearer {opts.VoyageApiKey}");
    client.Timeout = TimeSpan.FromSeconds(30);
});

builder.Services.AddScoped<ILLMClient, AnthropicClient>();
builder.Services.AddScoped<IEmbeddingService, EmbeddingService>();
builder.Services.AddScoped<IVectorSearchService, VectorSearchService>();
builder.Services.AddScoped<IAgentConversationRepository, AgentConversationRepository>();
builder.Services.AddScoped<DecomposeTool>();
builder.Services.AddScoped<EstimateTool>();
builder.Services.AddScoped<SearchTool>();
builder.Services.AddScoped<ReportTool>();
builder.Services.AddScoped<AgentOrchestrator>();

// ─────────────────────────────────────────────────────────
builder.Services.AddControllers();

// ── SignalR ───────────────────────────────────────────────
builder.Services.AddSignalR();

// ── CORS ──────────────────────────────────────────────────
builder.Services.AddCors(options =>
    options.AddPolicy("Frontend", policy =>
        policy.SetIsOriginAllowed(origin =>
                  Uri.TryCreate(origin, UriKind.Absolute, out var uri) &&
                  uri.Host == "localhost")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()));

var app = builder.Build();

app.UseCors("Frontend");
app.MapControllers();
app.MapHub<AgentHub>("/hubs/agent");

// ── Auto-migration ────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

app.Run();
