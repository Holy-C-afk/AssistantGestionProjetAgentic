import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import KanbanColumn from './KanbanColumn';
import TaskCard from './TaskCard';
import { getSprintBoard } from '../api/sprintApi';
import { moveTask, createTask } from '../api/taskApi';
import { useToast } from '../context/ToastContext';

const COLUMNS = ['todo', 'clarifier', 'in_progress', 'done', 'blocked'];

// Critical → High → Medium → Low
const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const byPriority = (a, b) =>
  (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);

export default function KanbanBoard({ sprintId, projectId, onTaskClick, refreshKey, onAutoRefresh, isAdmin = true }) {
  const { t } = useTranslation();
  const [board, setBoard] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const { show } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchBoard = async () => {
    if (!sprintId) { setBoard(null); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await getSprintBoard(projectId, sprintId);
      const rawTasks = data.tasks ?? data.Tasks ?? [];
      const columns = { todo: [], clarifier: [], in_progress: [], done: [], blocked: [] };
      rawTasks.forEach(t => {
        const s = t.status ?? t.Status;
        if (columns[s]) columns[s].push(t);
        else columns[s] = [t];
      });
      Object.keys(columns).forEach(k => columns[k].sort(byPriority));
      setBoard({ ...data, columns });
    } catch (e) {
      console.error(e);
      setBoard(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBoard(); }, [sprintId, refreshKey]);

  const handleDragStart = (event) => {
    setActiveTask(event.active.data.current?.task);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const targetStatus = over.id;
    const task = active.data.current?.task;
    if (!task || task.status === targetStatus) return;

    setBoard(prev => {
      if (!prev) return prev;
      const updated = { ...prev, columns: { ...prev.columns } };
      updated.columns[task.status] = (updated.columns[task.status] || []).filter(t => t.id !== task.id);
      const dest = [...(updated.columns[targetStatus] || []), { ...task, status: targetStatus }];
      updated.columns[targetStatus] = dest.sort(byPriority);
      return updated;
    });

    try {
      const result = await moveTask(task.id, targetStatus);
      if (result?.sprintAutoClosed || result?.projectAutoCompleted
          || result?.sprintReopened || result?.projectReactivated) {
        onAutoRefresh?.({
          sprintAutoClosed:     result.sprintAutoClosed,
          projectAutoCompleted: result.projectAutoCompleted,
          sprintReopened:       result.sprintReopened,
          projectReactivated:   result.projectReactivated,
        });
      }
    } catch (e) {
      console.error(e);
      fetchBoard();
    }
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    const title = newTitle.trim();
    try {
      const result = await createTask({ projectId, sprintId, title, priority: 'medium' });
      setNewTitle('');
      setShowAdd(false);
      fetchBoard();
      show({ type: 'success', title: t('board.toast.created'), description: title });
      if (result?.sprintReopened || result?.projectReactivated) {
        onAutoRefresh?.({ sprintReopened: result.sprintReopened, projectReactivated: result.projectReactivated });
      }
    } catch (e) {
      console.error(e);
      show({ type: 'error', title: t('common.error'), description: t('board.errorCreate') });
    }
  };

  if (!sprintId) {
    return (
      <div className="rounded-2xl border p-10 text-center"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <p style={{ color: 'var(--text-3)' }}>{t('board.selectSprint')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border p-10 text-center"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <p style={{ color: 'var(--text-3)' }}>{t('board.loading')}</p>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="rounded-2xl border p-10 text-center"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <p style={{ color: 'var(--text-3)' }}>{t('board.error')}</p>
      </div>
    );
  }

  return (
    <div>
      {showAdd && (
        <div className="rounded-xl border p-4 mb-4 flex gap-2"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <input
            type="text"
            autoFocus
            placeholder={t('board.newTask')}
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') { setShowAdd(false); setNewTitle(''); }
            }}
            className="flex-1 px-3 py-2 text-sm rounded-xl border outline-none transition-all"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <button
            onClick={handleAdd}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
            style={{ background: 'var(--accent)' }}>
            {t('board.create')}
          </button>
          <button
            onClick={() => { setShowAdd(false); setNewTitle(''); }}
            className="px-4 py-2 rounded-xl text-sm border transition-colors"
            style={{ color: 'var(--text-2)', borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
            {t('common.cancel')}
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(status => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={board.columns?.[status] || []}
              onTaskClick={onTaskClick}
              onAddTask={isAdmin && status === 'todo' ? () => setShowAdd(true) : undefined}
              onPriorityChanged={fetchBoard}
              isAdmin={isAdmin}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
