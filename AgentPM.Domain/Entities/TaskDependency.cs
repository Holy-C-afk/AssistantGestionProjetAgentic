using System;
using System.Collections.Generic;
using System.Text;

namespace AgentPM.Domain.Entities
{
    public class TaskDependency
    {
        public Guid TaskId { get; set; }
        public Guid DependsOnTaskId { get; set; }
    }

}
