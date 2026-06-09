using AgentPM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace AgentPM.Infrastructure.Persistence;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.ConfigureWarnings(w =>
            w.Ignore(RelationalEventId.PendingModelChangesWarning));
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectMember> ProjectMembers => Set<ProjectMember>();
    public DbSet<Sprint> Sprints => Set<Sprint>();
    public DbSet<TaskItem> Tasks => Set<TaskItem>();
    public DbSet<TaskDependency> TaskDependencies => Set<TaskDependency>();
    public DbSet<TaskComment> TaskComments => Set<TaskComment>();
    public DbSet<AgentConversation> AgentConversations => Set<AgentConversation>();
    public DbSet<AgentMessage> AgentMessages => Set<AgentMessage>();
    public DbSet<TaskEmbedding> TaskEmbeddings => Set<TaskEmbedding>();
    public DbSet<EventStoreEntry> EventStores => Set<EventStoreEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.HasPostgresExtension("vector");

        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Role).HasDefaultValue("member");
        });

        modelBuilder.Entity<Project>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Owner)
             .WithMany(x => x.OwnedProjects)
             .HasForeignKey(x => x.OwnerId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ProjectMember>(e =>
        {
            e.HasKey(x => new { x.ProjectId, x.UserId });
            e.HasOne(x => x.Project).WithMany(x => x.Members).HasForeignKey(x => x.ProjectId);
            e.HasOne(x => x.User).WithMany(x => x.ProjectMemberships).HasForeignKey(x => x.UserId);
        });

        modelBuilder.Entity<Sprint>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Project).WithMany(x => x.Sprints).HasForeignKey(x => x.ProjectId);
        });

        modelBuilder.Entity<TaskItem>(e =>
        {
            e.ToTable("tasks");
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Project).WithMany(x => x.Tasks).HasForeignKey(x => x.ProjectId);
            e.HasOne(x => x.Sprint).WithMany(x => x.Tasks).HasForeignKey(x => x.SprintId).IsRequired(false);
            e.HasOne(x => x.Assignee).WithMany().HasForeignKey(x => x.AssigneeId).IsRequired(false).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.CreatedBy).WithMany().HasForeignKey(x => x.CreatedById).OnDelete(DeleteBehavior.Restrict);
            e.Property(x => x.Order).HasColumnName("order");
            e.Property(x => x.Tags).HasColumnType("jsonb").HasDefaultValueSql("'[]'::jsonb");
            e.Property(x => x.AssigneeIds).HasColumnType("jsonb").HasDefaultValueSql("'[]'::jsonb");
        });

        modelBuilder.Entity<TaskDependency>(e =>
        {
            e.HasKey(x => new { x.TaskId, x.DependsOnTaskId });
        });

        modelBuilder.Entity<TaskComment>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Task).WithMany(x => x.Comments).HasForeignKey(x => x.TaskId);
            e.HasOne(x => x.Author).WithMany().HasForeignKey(x => x.AuthorId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AgentConversation>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Project).WithMany(x => x.AgentConversations).HasForeignKey(x => x.ProjectId);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AgentMessage>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Conversation).WithMany(x => x.Messages).HasForeignKey(x => x.ConversationId);
        });

        modelBuilder.Entity<TaskEmbedding>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Task).WithOne(x => x.Embedding).HasForeignKey<TaskEmbedding>(x => x.TaskId);
            e.Property(x => x.Embedding)
             .HasColumnType("vector(1536)");
        });

        modelBuilder.Entity<EventStoreEntry>(e =>
        {
            e.ToTable("event_store");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.AggregateId, x.Version }).IsUnique();
            e.Property(x => x.Payload).HasColumnType("jsonb");
        });
    }
}