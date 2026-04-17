import { useEffect, useState } from 'react';
import { getSprints, createSprint, closeSprint } from '../api/sprintApi';

export default function SprintSelector({ projectId, selectedSprintId, onSelect, onSprintsChange }) {
  const [sprints, setSprints] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', goal: '', startDate: '', endDate: '' });
  const [formError, setFormError] = useState('');

  const fetchSprints = async () => {
    if (!projectId) return;
    try {
      const data = await getSprints(projectId);
      setSprints(data);
      onSprintsChange?.(data);
      if (!selectedSprintId && data.length > 0) {
        onSelect(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchSprints(); }, [projectId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      const newSprint = await createSprint({
        projectId,
        name: form.name,
        goal: form.goal || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      });
      setForm({ name: '', goal: '', startDate: '', endDate: '' });
      setShowForm(false);
      await fetchSprints();
      onSelect(newSprint.id);
    } catch (e) {
      console.error(e);
      setFormError(e?.response?.data?.message || 'Erreur lors de la création.');
    }
  };

  const handleClose = async (sprintId, e) => {
    e.stopPropagation();
    if (!confirm('Clôturer ce sprint ?')) return;
    try {
      await closeSprint(sprintId);
      await fetchSprints();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Sprints</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-indigo-600 text-sm hover:underline"
        >
          {showForm ? 'Annuler' : '+ Nouveau Sprint'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 p-3 bg-gray-50 rounded-lg space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nom *</label>
            <input
              required
              placeholder="Sprint 1"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Objectif</label>
            <input
              placeholder="Objectif du sprint"
              value={form.goal}
              onChange={e => setForm({ ...form, goal: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date de début</label>
            <input
              type="date"
              value={form.startDate}
              onChange={e => setForm({ ...form, startDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date de fin</label>
            <input
              type="date"
              value={form.endDate}
              onChange={e => setForm({ ...form, endDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {formError && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
          )}
          <button
            type="submit"
            className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700 w-full"
          >
            Créer Sprint
          </button>
        </form>
      )}

      {sprints.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-3">Aucun sprint.</p>
      ) : (
        <div className="space-y-2">
          {sprints.map(s => (
            <div
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`p-3 rounded-lg cursor-pointer border transition ${
                selectedSprintId === s.id
                  ? 'bg-indigo-50 border-indigo-300'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm text-gray-900 truncate">{s.name}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                      s.status === 'active' ? 'bg-green-100 text-green-700'
                      : s.status === 'closed' ? 'bg-gray-200 text-gray-600'
                      : 'bg-blue-100 text-blue-700'
                    }`}>
                      {s.status}
                    </span>
                  </div>
                  {s.goal && <p className="text-xs text-gray-500 mt-1 truncate">{s.goal}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {s.taskCount} tâche(s)
                    {s.velocity > 0 && ` • ${s.velocity} pts`}
                  </p>
                </div>
                {s.status !== 'closed' && (
                  <button
                    onClick={(e) => handleClose(s.id, e)}
                    className="text-xs text-gray-400 hover:text-red-500 shrink-0"
                    title="Clôturer"
                  >
                    Clôturer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
