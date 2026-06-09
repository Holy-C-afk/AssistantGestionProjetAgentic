import { useEffect, useState } from 'react';
import { getSprints, createSprint, closeSprint, deleteSprint, updateSprintDates } from '../api/sprintApi';
import { useToast } from '../context/ToastContext';

export default function SprintSelector({ projectId, selectedSprintId, onSelect, onSprintsChange, refreshKey, onAutoRefresh, isAdmin = true }) {
  const [sprints, setSprints]         = useState([]);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState({ name: '', goal: '', startDate: '', endDate: '' });
  const [formError, setFormError]     = useState('');
  const [editingId, setEditingId]     = useState(null); // sprint being date-edited
  const [editDates, setEditDates]     = useState({ startDate: '', endDate: '' });
  const [deleteError, setDeleteError] = useState('');
  const [closeError, setCloseError]   = useState(null); // { message, tasks }
  const { show } = useToast();

  const fetchSprints = async () => {
    if (!projectId) return;
    try {
      const data = await getSprints(projectId);
      setSprints(data);
      onSprintsChange?.(data);
      if (!selectedSprintId && data.length > 0) onSelect(data[0].id);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchSprints(); }, [projectId, refreshKey]);

  /* ── Create sprint ── */
  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (form.startDate && form.endDate && form.startDate >= form.endDate) {
      setFormError('La date de début doit être antérieure à la date de fin.');
      return;
    }
    try {
      const result = await createSprint(projectId, {
        name: form.name, goal: form.goal || null,
        startDate: form.startDate || null, endDate: form.endDate || null,
      });
      const newSprint = result.sprint ?? result;
      const sprintName = form.name;
      setForm({ name: '', goal: '', startDate: '', endDate: '' });
      setShowForm(false);
      await fetchSprints();
      onSelect(newSprint.id);
      show({ type: 'success', title: '🚀 Sprint créé', description: sprintName });
      if (result.projectReactivated) onAutoRefresh?.({ projectReactivated: true });
    } catch (e) {
      setFormError(e?.response?.data?.message || 'Erreur lors de la création.');
      show({ type: 'error', title: 'Erreur', description: 'Impossible de créer le sprint.' });
    }
  };

  /* ── Save dates ── */
  const handleSaveDates = async (sprintId) => {
    try {
      await updateSprintDates(projectId, sprintId, {
        startDate: editDates.startDate || null,
        endDate:   editDates.endDate   || null,
      });
      show({ type: 'success', title: '📅 Dates mises à jour' });
      setEditingId(null);
      await fetchSprints();
    } catch (e) {
      show({ type: 'error', title: 'Erreur', description: e?.response?.data?.message || 'Impossible de modifier les dates.' });
    }
  };

  /* ── Close sprint ── */
  const handleClose = async (sprintId, e) => {
    e.stopPropagation();
    setCloseError(null);
    if (!confirm('Clôturer ce sprint ? Toutes les tâches doivent être terminées.')) return;
    try {
      await closeSprint(projectId, sprintId);
      await fetchSprints();
      show({ type: 'success', title: '✅ Sprint clôturé' });
    } catch (err) {
      const data = err?.response?.data;
      const msg  = data?.message || 'Impossible de clôturer le sprint.';
      const tasks = data?.unfinishedTasks || [];
      setCloseError({ message: msg, tasks });
      show({ type: 'error', title: '🚫 Clôture bloquée', description: `${data?.unfinishedCount ?? ''} tâche(s) non terminée(s) — notifications envoyées` });
    }
  };

  /* ── Delete sprint ── */
  const handleDelete = async (sprintId, e) => {
    e.stopPropagation();
    setDeleteError('');
    if (!confirm('Supprimer ce sprint ? Les tâches "À faire" seront déplacées vers le backlog.')) return;
    try {
      const result = await deleteSprint(projectId, sprintId);
      if (selectedSprintId === sprintId) onSelect(null);
      await fetchSprints();
      if (result?.projectAutoCompleted) onAutoRefresh?.({ projectAutoCompleted: true });
    } catch (e) {
      const msg = e?.response?.data?.message || 'Impossible de supprimer le sprint.';
      setDeleteError(msg);
      show({ type: 'error', title: '⛔ Suppression bloquée', description: msg });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Sprints</h3>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="text-indigo-600 text-sm hover:underline">
            {showForm ? 'Annuler' : '+ Nouveau Sprint'}
          </button>
        )}
      </div>

      {/* Delete error banner */}
      {deleteError && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg flex items-start gap-2">
          <span>⛔</span>
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError('')} className="ml-auto text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {/* Close error banner — shows unfinished tasks */}
      {closeError && (
        <div className="mb-3 bg-orange-50 border border-orange-200 text-orange-800 text-xs rounded-lg overflow-hidden">
          <div className="px-3 py-2 flex items-start gap-2">
            <span>🚫</span>
            <div className="flex-1">
              <p className="font-semibold">{closeError.message}</p>
              <p className="text-orange-600 mt-0.5">📧 Notifications envoyées aux personnes assignées et au chef de projet.</p>
            </div>
            <button onClick={() => setCloseError(null)} className="text-orange-400 hover:text-orange-600 shrink-0">×</button>
          </div>
          {closeError.tasks.length > 0 && (
            <div className="border-t border-orange-200 px-3 py-2 space-y-1">
              {closeError.tasks.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    t.status === 'in_progress' ? 'bg-blue-400' :
                    t.status === 'blocked'     ? 'bg-red-400'  : 'bg-gray-400'
                  }`} />
                  <span className="flex-1 truncate">{t.title}</span>
                  {t.assigneeName && <span className="text-orange-500 shrink-0">{t.assigneeName}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create form */}
      {showForm && isAdmin && (
        <form onSubmit={handleCreate} className="mb-4 p-3 bg-gray-50 rounded-lg space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nom *</label>
            <input required placeholder="Sprint 1" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Objectif</label>
            <input placeholder="Objectif du sprint" value={form.goal}
              onChange={e => setForm({ ...form, goal: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Début</label>
              <input type="date" value={form.startDate}
                onChange={e => setForm({ ...form, startDate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fin</label>
              <input type="date" value={form.endDate}
                onChange={e => setForm({ ...form, endDate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          {formError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}
          <button type="submit" className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700 w-full">
            Créer Sprint
          </button>
        </form>
      )}

      {sprints.length === 0
        ? <p className="text-sm text-gray-400 italic text-center py-3">Aucun sprint.</p>
        : (
          <div className="space-y-2">
            {sprints.map(s => (
              <div key={s.id}>
                <div
                  onClick={() => onSelect(s.id)}
                  className={`p-3 rounded-lg cursor-pointer border transition ${
                    selectedSprintId === s.id ? 'bg-indigo-50 border-indigo-300' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-sm text-gray-900 truncate">{s.name}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                          s.status === 'active' ? 'bg-green-100 text-green-700'
                          : s.status === 'closed' ? 'bg-gray-200 text-gray-600'
                          : 'bg-blue-100 text-blue-700'
                        }`}>{s.status}</span>
                      </div>
                      {s.goal && <p className="text-xs text-gray-500 mt-1 truncate">{s.goal}</p>}

                      {/* Dates display */}
                      <p className="text-xs text-gray-400 mt-1">
                        {s.taskCount} tâche(s){s.velocity > 0 && ` • ${s.velocity} pts`}
                        {(s.startDate || s.endDate) && (
                          <span className="ml-1">
                            · {s.startDate ?? '?'} → {s.endDate ?? '?'}
                          </span>
                        )}
                      </p>
                    </div>

                    {isAdmin && (
                      <div className="flex flex-col gap-1 shrink-0 items-end">
                        {/* Edit dates button */}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setEditingId(editingId === s.id ? null : s.id);
                            setEditDates({ startDate: s.startDate ?? '', endDate: s.endDate ?? '' });
                          }}
                          className="text-xs text-indigo-400 hover:text-indigo-600"
                          title="Modifier les dates"
                        >📅 Dates</button>
                        {s.status !== 'closed' && (
                          <button onClick={e => handleClose(s.id, e)}
                            className="text-xs text-gray-400 hover:text-orange-500">
                            Clôturer
                          </button>
                        )}
                        <button onClick={e => handleDelete(s.id, e)}
                          className="text-xs text-gray-400 hover:text-red-500">
                          Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline date editor */}
                {editingId === s.id && (
                  <div
                    onClick={e => e.stopPropagation()}
                    className="mt-1 p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2"
                  >
                    <p className="text-xs font-semibold text-indigo-700">Modifier les dates</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Début</label>
                        <input type="date" value={editDates.startDate}
                          onChange={e => setEditDates(d => ({ ...d, startDate: e.target.value }))}
                          className="w-full border border-indigo-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Fin</label>
                        <input type="date" value={editDates.endDate}
                          onChange={e => setEditDates(d => ({ ...d, endDate: e.target.value }))}
                          className="w-full border border-indigo-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleSaveDates(s.id)}
                        className="flex-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-indigo-700">
                        Enregistrer
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="flex-1 bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-300">
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}
