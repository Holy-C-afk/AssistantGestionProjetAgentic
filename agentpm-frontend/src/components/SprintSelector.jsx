import { useEffect, useState } from 'react';
import { getSprints, createSprint, closeSprint, deleteSprint, updateSprintDates } from '../api/sprintApi';
import { useToast } from '../context/ToastContext';

const SPRINT_STATUS = {
  planned:   { label: 'Planifié',  bg: '#EFF9FB', text: '#0E7490'  },
  active:    { label: 'Actif',     bg: '#F0FDF4', text: '#15803D'  },
  closed:    { label: 'Clôturé',   bg: '#F4F2EE', text: '#6B6560'  },
  completed: { label: 'Terminé',   bg: '#EFF6FF', text: '#1D4ED8'  },
};

const IconChevron = ({ down }) => (
  <svg className={`w-3.5 h-3.5 transition-transform ${down ? 'rotate-180' : ''}`}
    fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

export default function SprintSelector({
  projectId, selectedSprintId, onSelect, onSprintsChange,
  refreshKey, onAutoRefresh, isAdmin = true,
}) {
  const [sprints,   setSprints]   = useState([]);
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState({ name: '', goal: '', startDate: '', endDate: '' });
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDates, setEditDates] = useState({ startDate: '', endDate: '' });
  const [deleteError, setDeleteError] = useState('');
  const [closeError,  setCloseError]  = useState(null);
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

  const handleCreate = async (e) => {
    e.preventDefault(); setFormError('');
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
      setForm({ name: '', goal: '', startDate: '', endDate: '' });
      setShowForm(false);
      await fetchSprints();
      onSelect(newSprint.id);
      show({ type: 'success', title: 'Sprint créé', description: form.name });
      if (result.projectReactivated) onAutoRefresh?.({ projectReactivated: true });
    } catch (e) {
      setFormError(e?.response?.data?.message || 'Erreur lors de la création.');
    }
  };

  const handleSaveDates = async (sprintId) => {
    try {
      await updateSprintDates(projectId, sprintId, {
        startDate: editDates.startDate || null,
        endDate:   editDates.endDate   || null,
      });
      show({ type: 'success', title: 'Dates mises à jour' });
      setEditingId(null);
      await fetchSprints();
    } catch (e) {
      show({ type: 'error', title: 'Erreur', description: e?.response?.data?.message || 'Impossible de modifier les dates.' });
    }
  };

  const handleClose = async (sprintId, e) => {
    e.stopPropagation(); setCloseError(null);
    if (!confirm('Clôturer ce sprint ?')) return;
    try {
      await closeSprint(projectId, sprintId);
      await fetchSprints();
      show({ type: 'success', title: 'Sprint clôturé' });
    } catch (err) {
      const data  = err?.response?.data;
      const tasks = data?.unfinishedTasks || [];
      setCloseError({ message: data?.message || 'Impossible de clôturer.', tasks });
      show({ type: 'error', title: 'Clôture bloquée', description: `${data?.unfinishedCount ?? ''} tâche(s) non terminée(s)` });
    }
  };

  const handleDelete = async (sprintId, e) => {
    e.stopPropagation(); setDeleteError('');
    if (!confirm('Supprimer ce sprint ?')) return;
    try {
      const result = await deleteSprint(projectId, sprintId);
      if (selectedSprintId === sprintId) onSelect(null);
      await fetchSprints();
      if (result?.projectAutoCompleted) onAutoRefresh?.({ projectAutoCompleted: true });
    } catch (e) {
      const msg = e?.response?.data?.message || 'Impossible de supprimer.';
      setDeleteError(msg);
      show({ type: 'error', title: 'Suppression bloquée', description: msg });
    }
  };

  return (
    <div className="rounded-2xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Sprints</h3>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
            style={{
              color: showForm ? 'var(--danger)' : 'var(--accent)',
              background: showForm ? 'var(--danger-bg)' : 'var(--accent-light)',
            }}>
            {showForm ? 'Annuler' : '+ Sprint'}
          </button>
        )}
      </div>

      {/* Alerts */}
      {deleteError && (
        <div className="mx-4 mt-3 flex items-start gap-2 text-xs px-3 py-2.5 rounded-xl border"
          style={{ background: 'var(--danger-bg)', borderColor: '#FCA5A5', color: 'var(--danger)' }}>
          <span className="shrink-0 mt-0.5">⊘</span>
          <span className="flex-1">{deleteError}</span>
          <button onClick={() => setDeleteError('')} className="shrink-0 hover:opacity-70">✕</button>
        </div>
      )}

      {closeError && (
        <div className="mx-4 mt-3 rounded-xl border overflow-hidden text-xs"
          style={{ background: 'var(--warning-bg)', borderColor: '#FDE68A', color: 'var(--warning)' }}>
          <div className="flex items-start gap-2 px-3 py-2.5">
            <span className="shrink-0 mt-0.5">⚠</span>
            <div className="flex-1">
              <p className="font-semibold">{closeError.message}</p>
              <p className="mt-0.5 opacity-75">Notifications envoyées aux membres concernés.</p>
            </div>
            <button onClick={() => setCloseError(null)} className="shrink-0 hover:opacity-70">✕</button>
          </div>
          {closeError.tasks.length > 0 && (
            <div className="px-3 pb-3 space-y-1" style={{ borderTop: '1px solid #FDE68A' }}>
              <p className="pt-2 font-medium opacity-75">Tâches non terminées :</p>
              {closeError.tasks.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    t.status === 'in_progress' ? 'bg-blue-400' :
                    t.status === 'blocked'     ? 'bg-red-400'  : 'bg-gray-400'
                  }`} />
                  <span className="flex-1 truncate">{t.title}</span>
                  {t.assigneeName && <span className="opacity-60 shrink-0">{t.assigneeName}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create form */}
      {showForm && isAdmin && (
        <form onSubmit={handleCreate} className="m-4 p-4 rounded-xl space-y-3"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
            Nouveau sprint
          </p>

          <FormInput label="Nom" required
            placeholder="Sprint 1"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} />

          <FormInput label="Objectif"
            placeholder="Objectif du sprint"
            value={form.goal}
            onChange={e => setForm({ ...form, goal: e.target.value })} />

          <div className="grid grid-cols-2 gap-2">
            <FormInput label="Début" type="date"
              value={form.startDate}
              onChange={e => setForm({ ...form, startDate: e.target.value })} />
            <FormInput label="Fin" type="date"
              value={form.endDate}
              onChange={e => setForm({ ...form, endDate: e.target.value })} />
          </div>

          {formError && (
            <p className="text-xs px-3 py-2 rounded-lg"
              style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
              {formError}
            </p>
          )}

          <button type="submit"
            className="w-full py-2 rounded-xl text-sm font-semibold text-white transition-colors"
            style={{ background: 'var(--accent)' }}>
            Créer
          </button>
        </form>
      )}

      {/* Sprint list */}
      <div className="p-3 space-y-1">
        {sprints.length === 0 ? (
          <p className="text-xs italic text-center py-5" style={{ color: 'var(--text-3)' }}>
            Aucun sprint
          </p>
        ) : (
          sprints.map(s => {
            const statusCfg = SPRINT_STATUS[s.status] ?? { label: s.status, bg: 'var(--surface-2)', text: 'var(--text-2)' };
            const isSelected = selectedSprintId === s.id;

            return (
              <div key={s.id}>
                {/* Sprint row */}
                <div
                  onClick={() => onSelect(s.id)}
                  className="relative rounded-xl px-3 py-2.5 cursor-pointer transition-all group"
                  style={{
                    background: isSelected ? 'var(--accent-light)' : 'transparent',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-2)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h4 className="font-medium text-sm truncate" style={{ color: isSelected ? 'var(--accent-text)' : 'var(--text-1)' }}>
                          {s.name}
                        </h4>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                          style={{ background: statusCfg.bg, color: statusCfg.text }}>
                          {statusCfg.label}
                        </span>
                      </div>

                      {s.goal && (
                        <p className="text-xs truncate mb-0.5" style={{ color: 'var(--text-3)' }}>
                          {s.goal}
                        </p>
                      )}

                      <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                        {s.taskCount} tâche{s.taskCount !== 1 ? 's' : ''}
                        {s.velocity > 0 && ` · ${s.velocity} pts`}
                        {(s.startDate || s.endDate) && (
                          <span className="ml-1">
                            · {s.startDate ?? '?'} → {s.endDate ?? '?'}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Admin actions — visible on hover */}
                    {isAdmin && (
                      <div className="flex flex-col gap-1 shrink-0 items-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setEditingId(editingId === s.id ? null : s.id);
                            setEditDates({ startDate: s.startDate ?? '', endDate: s.endDate ?? '' });
                          }}
                          className="text-xs transition-colors px-1.5 py-0.5 rounded"
                          style={{ color: 'var(--accent)', background: 'var(--accent-light)' }}>
                          Dates
                        </button>
                        {s.status !== 'closed' && (
                          <button onClick={e => handleClose(s.id, e)}
                            className="text-xs px-1.5 py-0.5 rounded transition-colors"
                            style={{ color: 'var(--warning)', background: 'var(--warning-bg)' }}>
                            Clôturer
                          </button>
                        )}
                        <button onClick={e => handleDelete(s.id, e)}
                          className="text-xs px-1.5 py-0.5 rounded transition-colors"
                          style={{ color: 'var(--danger)', background: 'var(--danger-bg)' }}>
                          Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Date editor */}
                {editingId === s.id && (
                  <div onClick={e => e.stopPropagation()}
                    className="mt-1 mb-1 mx-1 p-3 rounded-xl space-y-2 border"
                    style={{ background: 'var(--accent-light)', borderColor: 'var(--accent)' }}>
                    <p className="text-xs font-semibold" style={{ color: 'var(--accent-text)' }}>
                      Modifier les dates
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <FormInput label="Début" type="date"
                        value={editDates.startDate}
                        onChange={e => setEditDates(d => ({ ...d, startDate: e.target.value }))} />
                      <FormInput label="Fin" type="date"
                        value={editDates.endDate}
                        onChange={e => setEditDates(d => ({ ...d, endDate: e.target.value }))} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleSaveDates(s.id)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                        style={{ background: 'var(--accent)' }}>
                        Enregistrer
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="flex-1 py-1.5 rounded-lg text-xs border transition-colors"
                        style={{ color: 'var(--text-2)', borderColor: 'var(--border)', background: 'var(--surface)' }}>
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function FormInput({ label, required, type = 'text', placeholder, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>
        {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
      />
    </div>
  );
}
