import { useEffect, useState } from 'react';
import { getTask, updateTask, deleteTask, getTaskComments, addTaskComment, deleteTaskComment } from '../api/taskApi';

export default function TaskDetailModal({ taskId, onClose, onUpdated }) {
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    Promise.all([getTask(taskId), getTaskComments(taskId)])
      .then(([t, c]) => {
        setTask(t);
        setForm({
          title: t.title,
          description: t.description || '',
          priority: t.priority,
          storyPoints: t.storyPoints ?? '',
          assigneeId: t.assigneeId || '',
        });
        setComments(c);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [taskId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateTask(taskId, {
        title: form.title,
        description: form.description,
        priority: form.priority,
        storyPoints: form.storyPoints === '' ? null : parseInt(form.storyPoints, 10),
        assigneeId: form.assigneeId || null,
      });
      setTask(updated);
      onUpdated?.();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Supprimer cette tâche ?')) return;
    try {
      await deleteTask(taskId);
      onUpdated?.();
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      const c = await addTaskComment(taskId, newComment.trim());
      setComments([...comments, c]);
      setNewComment('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await deleteTaskComment(taskId, commentId);
      setComments(comments.filter(c => c.id !== commentId));
    } catch (e) {
      console.error(e);
    }
  };

  if (!taskId) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {loading || !task || !form ? (
          <div className="p-10 text-center text-gray-400">Chargement...</div>
        ) : (
          <>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Détail de la tâche</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Titre</label>
                <input
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Priorité</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="low">Basse</option>
                    <option value="medium">Moyenne</option>
                    <option value="high">Haute</option>
                    <option value="critical">Critique</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Story Points</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.storyPoints}
                    onChange={e => setForm({ ...form, storyPoints: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Statut</label>
                  <input
                    value={task.status}
                    disabled
                    className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Assigné à (User ID)</label>
                <input
                  value={form.assigneeId}
                  onChange={e => setForm({ ...form, assigneeId: e.target.value })}
                  placeholder="UUID utilisateur"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {task.assigneeName && (
                  <p className="text-xs text-gray-500 mt-1">Actuel : {task.assigneeName}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button
                  onClick={handleDelete}
                  className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-100 border border-red-200"
                >
                  Supprimer
                </button>
              </div>
            </div>

            <div className="border-t border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                Commentaires ({comments.length})
              </h3>

              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                {comments.length === 0 && (
                  <p className="text-sm text-gray-400 italic">Aucun commentaire.</p>
                )}
                {comments.map(c => (
                  <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center">
                          {c.authorName?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{c.authorName}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(c.createdAt).toLocaleString('fr-FR')}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="text-gray-400 hover:text-red-500 text-xs"
                      >
                        Supprimer
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ajouter un commentaire..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700"
                >
                  Publier
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
