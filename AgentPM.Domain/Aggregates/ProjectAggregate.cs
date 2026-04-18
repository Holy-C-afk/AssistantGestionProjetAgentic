using AgentPM.Domain.Entities;
using AgentPM.Domain.Events;

namespace AgentPM.Domain.Aggregates;

public class ProjectAggregate
{
    public Project Project { get; private set; }
    private readonly List<object> _domainEvents = [];

    public IReadOnlyList<object> DomainEvents => _domainEvents.AsReadOnly();

    private ProjectAggregate(Project project)
    {
        Project = project;
    }

    public static ProjectAggregate Create(string name, string? description, Guid ownerId)
    {
        var project = new Project
        {
            Name = name,
            Description = description,
            OwnerId = ownerId,
            Status = "active"
        };

        var aggregate = new ProjectAggregate(project);

        aggregate._domainEvents.Add(new ProjectCreated(
            project.Id,
            project.Name,
            project.OwnerId,
            project.CreatedAt
        ));

        return aggregate;
    }
    public static ProjectAggregate Load(Project project)
    => new ProjectAggregate(project);

    public void Update(string name, string? description)
    {
        Project.Name = name;
        Project.Description = description;
    }

    public void AddMember(Guid userId, string role = "member")
    {
        var alreadyMember = Project.Members.Any(m => m.UserId == userId);
        if (alreadyMember)
            throw new InvalidOperationException("User is already a member.");

        var member = new ProjectMember
        {
            ProjectId = Project.Id,
            UserId = userId,
            Role = role
        };

        Project.Members.Add(member);

        _domainEvents.Add(new MemberAdded(
            Project.Id,
            userId,
            role,
            DateTime.UtcNow
        ));
    }

    public void RemoveMember(Guid userId)
    {
        var member = Project.Members.FirstOrDefault(m => m.UserId == userId)
            ?? throw new InvalidOperationException("User is not a member.");

        Project.Members.Remove(member);
    }

    public void ClearEvents() => _domainEvents.Clear();
}