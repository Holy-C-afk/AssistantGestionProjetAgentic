import { useEffect, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  rectIntersection, useDroppable, useDraggable,
} from '@dnd-kit/core';
import { getSprints } from '../api/sprintApi';
import { getTasks, changeTaskSprint } from '../api/taskApi';

/* ── Priority / status config ───────────────────────────────────── */
const PRIO = {
  critical: '#EF4444',
  high:     '#F97316',
  medium:   '#3B82F6',
  low:      '#94A3B8',
};
const STATUS_BADGE = {
  todo:          { bg: '#F1F5F9', text: '#475569', label: 'À faire'  },
  'in-progress': { bg: '#FEF9C3', text: '#854D0E', label: 'En cours' },
  done:          { bg: '#F0FDF4', text: '#15803D', label: 'Fait'     },
};

/* ── Draggable task card ────────────────────────────────────────── */
function DraggableTask({ task }) {
  const isDone = task.status === 'done';
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: isDone,
  });
  const dot = PRIO[task.priority] || '#94A3B8';
  const s   = STATUS_BADGE[task.status] || STATUS_BADGE.todo;

  return (
    <div
      ref={setNodeRef}
      {...(isDone ? {} : listeners)}
      {...(isDone ? {} : attributes)}
      className="rounded-xl border px-3 py-2.5 select-none"
      style={{
        background:  'var(--bg)',
        borderColor: isDragging ? 'var(--accent)' : 'var(--border)',
        opacity:     isDragging ? 0.35 : 1,
        cursor:      isDone ? 'default' : 'grab',
        touchAction: isDone ? 'auto' : 'none',
      }}
    >
      <p className="text-xs font-medium leading-snug line-clamp-2 mb-2"
        style={{ color: 'var(--text-1)' }}>
        {task.title}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-3)' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
          {task.priority}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
          style={{ background: s.bg, color: s.text }}>
          {s.label}
        </span>
        {task.assigneeName && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
            {task.assigneeName.split(' ')[0]}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Drag ghost (overlay while dragging) ────────────────────────── */
function DragGhost({ task }) {
  if (!task) return null;
  const dot = PRIO[task.priority] || '#94A3B8';
  const s   = STATUS_BADGE[task.status] || STATUS_BADGE.todo;
  return (
    <div className="rounded-xl border px-3 py-2.5 w-52 shadow-2xl"
      style={{
        background:  'var(--surface)',
        borderColor: 'var(--accent)',
        rotate:      '2deg',
        cursor:      'grabbing',
      }}>
      <p className="text-xs font-medium line-clamp-2 mb-2" style={{ color: 'var(--text-1)' }}>
        {task.title}
      </p>
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-3)' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
          {task.priority}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
          style={{ background: s.bg, color: s.text }}>{s.label}</span>
      </div>
    </div>
  );
}

/* ── Sprint column (droppable) ──────────────────────────────────── */
const SPRINT_COLOR = {
  planned:   '#94A3B8',
  active:    '#10B981',
  closed:    '#64748B',
  completed: '#3B82F6',
  backlog:   '#CBD5E1',
};

function SprintColumn({ sprintId, sprintName, sprintStatus, tasks, isOver }) {
  const { setNodeRef } = useDroppable({ id: sprintId });
  const bar = SPRINT_COLOR[sprintStatus ?? 'backlog'];

  return (
    <div
      className="flex flex-col rounded-2xl border overflow-hidden transition-colors"
      style={{
        background:  isOver ? 'var(--accent-light)' : 'var(--surface)',
        borderColor: isOver ? 'var(--accent)'       : 'var(--border)',
        width:       240,
        minWidth:    220,
        flexShrink:  0,
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: bar }} />
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>
            {sprintName}
          </span>
        </div>
        <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
          {tasks.length} tâche{tasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Drop zone — ref is here */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 min-h-28"
      >
        {tasks.length === 0 ? (
          <div className="h-16 flex items-center justify-center rounded-xl border-2 border-dashed"
            style={{ borderColor: isOver ? 'var(--accent)' : 'var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>
              {isOver ? '📥 Déposer ici' : 'Vide'}
            </span>
          </div>
        ) : tasks.map(task => (
          <DraggableTask key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────── */
export default function MultiSprintView({ projectId }) {
  const [sprints,    setSprints]    = useState([]);
  const [tasks,      setTasks]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTask, setActiveTask] = useState(null);
  const [overId,     setOverId]     = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([
      getSprints(projectId),
      getTasks({ projectId }),
    ]).then(([sp, tk]) => {
      setSprints(sp);
      const list = Array.isArray(tk) ? tk
        : Array.isArray(tk?.items) ? tk.items : [];
      setTasks(list);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  const getColTasks = (sprintId) =>
    tasks.filter(t => (sprintId === 'backlog' ? !t.sprintId : t.sprintId === sprintId));

  const handleDragStart = ({ active }) => {
    setActiveTask(tasks.find(t => t.id === active.id) ?? null);
  };

  const handleDragOver = ({ over }) => {
    setOverId(over?.id ?? null);
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveTask(null);
    setOverId(null);

    if (!over) return;

    const taskId      = active.id;
    const targetColId = over.id;                         // sprint id or 'backlog'
    const task        = tasks.find(t => t.id === taskId);
    if (!task) return;

    const currentColId = task.sprintId ?? 'backlog';
    if (currentColId === targetColId) return;            // same column — no-op

    const newSprintId = targetColId === 'backlog' ? null : targetColId;

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, sprintId: newSprintId } : t
    ));

    try {
      await changeTaskSprint(taskId, newSprintId);
    } catch {
      // Rollback
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, sprintId: task.sprintId } : t
      ));
    }
  };

  if (loading) return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-2xl border p-4 space-y-2 shrink-0"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', width: 240 }}>
          <div className="skeleton h-5 rounded w-3/4" />
          {[...Array(3)].map((_, j) => <div key={j} className="skeleton h-14 rounded-xl" />)}
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>
        Glissez-déposez les tâches entre les colonnes pour les réassigner à un sprint.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4" style={{ width: 'max-content' }}>

            {/* Backlog */}
            <SprintColumn
              sprintId="backlog"
              sprintName="Backlog"
              sprintStatus="backlog"
              tasks={getColTasks('backlog')}
              isOver={overId === 'backlog'}
            />

            {/* One column per sprint */}
            {sprints.map(s => (
              <SprintColumn
                key={s.id}
                sprintId={s.id}
                sprintName={s.name}
                sprintStatus={s.status}
                tasks={getColTasks(s.id)}
                isOver={overId === s.id}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 120, easing: 'ease' }}>
          <DragGhost task={activeTask} />
        </DragOverlay>
      </DndContext>
    </div>
  );
}
