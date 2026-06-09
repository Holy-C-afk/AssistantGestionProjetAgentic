import { useDroppable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import TaskCard from './TaskCard';

const COLUMN_META = {
  todo:        { accent: '#94A3B8', dot: '#94A3B8' },
  clarifier:   { accent: '#F59E0B', dot: '#F59E0B' },
  in_progress: { accent: '#0E7490', dot: '#0E7490' },
  done:        { accent: '#15803D', dot: '#15803D' },
  blocked:     { accent: '#DC2626', dot: '#DC2626' },
};

export default function KanbanColumn({ status, tasks, onTaskClick, onAddTask, onPriorityChanged, isAdmin = true }) {
  const { t } = useTranslation();
  const meta = COLUMN_META[status] || { accent: '#94A3B8', dot: '#94A3B8' };
  const label = t(`columns.${status}`, { defaultValue: status });
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className="flex-1 flex flex-col rounded-2xl transition-all duration-150"
      style={{
        minWidth: '260px',
        background: isOver ? 'color-mix(in srgb, var(--accent) 5%, var(--surface-2))' : 'var(--surface-2)',
        border: `1.5px solid ${isOver ? 'var(--accent)' : 'var(--border)'}`,
      }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5">
          {/* Colored dot */}
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.dot }} />
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
            {label}
          </h3>
          {/* Task count pill */}
          <span className="text-xs px-2 py-0.5 rounded-full font-medium tabular-nums"
            style={{ background: 'var(--border)', color: 'var(--text-2)' }}>
            {tasks.length}
          </span>
        </div>

        {onAddTask && status === 'todo' && (
          <button
            onClick={onAddTask}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-lg leading-none font-bold transition-colors"
            style={{ color: 'var(--accent)', background: 'transparent' }}
            title={t('board.addTask')}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            +
          </button>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 p-3 min-h-[200px] overflow-y-auto">
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-24">
            <p className="text-xs italic" style={{ color: 'var(--text-3)' }}>{t('columns.noTask')}</p>
          </div>
        )}
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={onTaskClick}
            onPriorityChanged={onPriorityChanged}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    </div>
  );
}
