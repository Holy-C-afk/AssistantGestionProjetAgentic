import { useDroppable } from '@dnd-kit/core';
import TaskCard from './TaskCard';

const columnMeta = {
  todo:       { label: 'À faire',    color: 'border-gray-300',  dot: 'bg-gray-400'  },
  clarifier:  { label: 'À clarifier', color: 'border-amber-300', dot: 'bg-amber-400' },
  in_progress:{ label: 'En cours',   color: 'border-blue-300',  dot: 'bg-blue-500'  },
  done:       { label: 'Terminé',    color: 'border-green-300', dot: 'bg-green-500' },
  blocked:    { label: 'Bloqué',     color: 'border-red-300',   dot: 'bg-red-500'   },
};

export default function KanbanColumn({ status, tasks, onTaskClick, onAddTask }) {
  const meta = columnMeta[status] || { label: status, color: 'border-gray-300', dot: 'bg-gray-400' };

  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[260px] bg-gray-50 rounded-xl border-2 border-dashed transition-colors ${
        isOver ? 'border-indigo-400 bg-indigo-50' : meta.color
      }`}
    >
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-white rounded-t-xl sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
          <h3 className="font-semibold text-gray-700 text-sm">{meta.label}</h3>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        {onAddTask && status === 'todo' && (
          <button
            onClick={onAddTask}
            className="text-indigo-600 hover:bg-indigo-50 rounded p-1 text-lg leading-none font-bold"
            title="Ajouter une tâche"
          >
            +
          </button>
        )}
      </div>

      <div className="p-3 min-h-[200px]">
        {tasks.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6 italic">Aucune tâche</p>
        )}
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} onClick={onTaskClick} />
        ))}
      </div>
    </div>
  );
}
