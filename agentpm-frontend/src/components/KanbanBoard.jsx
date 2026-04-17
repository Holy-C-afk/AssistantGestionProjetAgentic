import { useEffect, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import KanbanColumn from './KanbanColumn';
import TaskCard from './TaskCard';
import { getSprintBoard } from '../api/sprintApi';
import { moveTask, createTask } from '../api/taskApi';

const COLUMNS = ['todo', 'in_progress', 'done', 'blocked'];

export default function KanbanBoard({ sprintId, projectId, onTaskClick, refreshKey }) {
  const [board, setBoard] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchBoard = async () => {
    if (!sprintId) { setBoard(null); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await getSprintBoard(sprintId);
      setBoard(data);
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

    // optimistic UI update
    setBoard(prev => {
      if (!prev) return prev;
      const updated = { ...prev, columns: { ...prev.columns } };
      updated.columns[task.status] = (updated.columns[task.status] || []).filter(t => t.id !== task.id);
      updated.columns[targetStatus] = [...(updated.columns[targetStatus] || []), { ...task, status: targetStatus }];
      return updated;
    });

    try {
      await moveTask(task.id, targetStatus);
    } catch (e) {
      console.error(e);
      fetchBoard();
    }
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    try {
      await createTask({
        projectId,
        sprintId,
        title: newTitle.trim(),
        priority: 'medium',
      });
      setNewTitle('');
      setShowAdd(false);
      fetchBoard();
    } catch (e) {
      console.error(e);
    }
  };

  if (!sprintId) {
    return (
      <div className="bg-white rounded-xl shadow p-10 text-center">
        <p className="text-gray-400">Sélectionnez un sprint pour afficher le board.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow p-10 text-center">
        <p className="text-gray-400">Chargement du board...</p>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="bg-white rounded-xl shadow p-10 text-center">
        <p className="text-gray-400">Impossible de charger le board.</p>
      </div>
    );
  }

  return (
    <div>
      {showAdd && (
        <div className="bg-white rounded-xl shadow p-4 mb-4 flex gap-2">
          <input
            type="text"
            autoFocus
            placeholder="Titre de la nouvelle tâche..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleAdd}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700"
          >
            Créer
          </button>
          <button
            onClick={() => { setShowAdd(false); setNewTitle(''); }}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-300"
          >
            Annuler
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
              onAddTask={status === 'todo' ? () => setShowAdd(true) : undefined}
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
