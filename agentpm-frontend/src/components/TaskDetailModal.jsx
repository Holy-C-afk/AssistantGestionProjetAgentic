import { useEffect, useState } from 'react';
import {
  getTask, updateTask, deleteTask,
  getTaskComments, addTaskComment, deleteTaskComment,
  createTask, exportTaskPdf,
} from '../api/taskApi';
import { agentEstimate, agentDecompose } from '../api/agentApi';

/* ── Tag palette ────────────────────────────────────────────────── */
const TAG_COLORS = [
  { bg: '#F3E8FF', text: '#7C3AED' }, { bg: '#CCFBF1', text: '#0F766E' },
  { bg: '#FCE7F3', text: '#BE185D' }, { bg: '#FEF9C3', text: '#A16207' },
  { bg: '#CFFAFE', text: '#155E75' }, { bg: '#DCFCE7', text: '#15803D' },
];

/* ── SVG icons ──────────────────────────────────────────────────── */
const IconX = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IconSpin = () => (
  <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin inline-block" />
);
const IconAI = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);
const IconPdf = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);
const IconTrash = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

/* ────────────────────────────────────────────────────────────────── */
export default function TaskDetailModal({ taskId, members = [], isAdmin = true, onClose, onUpdated, onAutoRefresh }) {
  const currentUserId = sessionStorage.getItem('userId');

  const [task,     setTask]     = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [form,     setForm]     = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  // AI
  const [estimating,   setEstimating]   = useState(false);
  const [decomposing,  setDecomposing]  = useState(false);
  const [subTasks,     setSubTasks]     = useState(null);
  const [creatingIdx,  setCreatingIdx]  = useState(new Set());
  const [createdIdx,   setCreatedIdx]   = useState(new Set());

  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (!taskId) return;
    setLoading(true); setSubTasks(null);
    setCreatingIdx(new Set()); setCreatedIdx(new Set());
    Promise.all([getTask(taskId), getTaskComments(taskId)])
      .then(([t, c]) => {
        setTask(t);
        const effectiveIds = (t.assigneeIds && t.assigneeIds.length > 0)
          ? t.assigneeIds
          : (t.assigneeId ? [t.assigneeId] : []);
        setForm({
          title: t.title, description: t.description || '',
          priority: t.priority, storyPoints: t.storyPoints ?? '',
          assigneeIds: effectiveIds, tags: t.tags ?? [],
        });
        setComments(c);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [taskId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateTask(taskId, {
        title: form.title, description: form.description,
        priority: form.priority,
        storyPoints: form.storyPoints === '' ? null : parseInt(form.storyPoints, 10),
        assigneeIds: form.assigneeIds ?? [],
        assigneeId: form.assigneeIds?.[0] ?? null,
        tags: form.tags ?? [],
      });
      setTask(result?.task ?? result);
      onUpdated?.();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Supprimer cette tâche ?')) return;
    try {
      const result = await deleteTask(taskId);
      if (result?.sprintAutoClosed || result?.projectAutoCompleted) {
        onAutoRefresh?.({ sprintAutoClosed: result.sprintAutoClosed, projectAutoCompleted: result.projectAutoCompleted });
      }
      onUpdated?.(); onClose();
    } catch (e) { console.error(e); }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      const authorId = sessionStorage.getItem('userId');
      const c = await addTaskComment(taskId, newComment.trim(), authorId);
      setComments([...comments, c]); setNewComment('');
    } catch (e) { console.error(e); }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await deleteTaskComment(taskId, commentId);
      setComments(comments.filter(c => c.id !== commentId));
    } catch (e) { console.error(e); }
  };

  const handleEstimate = async () => {
    if (!form?.title) return;
    setEstimating(true);
    try {
      const { storyPoints } = await agentEstimate(form.title, form.description);
      if (storyPoints != null) setForm(f => ({ ...f, storyPoints: String(storyPoints) }));
    } catch (e) { console.error(e); }
    finally { setEstimating(false); }
  };

  const handleDecompose = async () => {
    if (!form?.title) return;
    setDecomposing(true); setSubTasks(null);
    try {
      const { subTasks: list } = await agentDecompose(form.title, form.description);
      setSubTasks(list ?? []); setCreatedIdx(new Set());
    } catch (e) { setSubTasks([]); }
    finally { setDecomposing(false); }
  };

  const handleCreateSubTask = async (title, idx) => {
    if (!task) return;
    setCreatingIdx(s => new Set(s).add(idx));
    try {
      await createTask({ title, projectId: task.projectId, sprintId: task.sprintId ?? null, priority: 'medium' });
      setCreatedIdx(s => new Set(s).add(idx)); onUpdated?.();
    } catch (e) { console.error(e); }
    finally { setCreatingIdx(s => { const n = new Set(s); n.delete(idx); return n; }); }
  };

  const handleCreateAll = async () => {
    if (!subTasks) return;
    for (let i = 0; i < subTasks.length; i++)
      if (!createdIdx.has(i)) await handleCreateSubTask(subTasks[i], i);
  };

  const toggleAssignee = (uid) => {
    setForm(f => {
      const cur = f.assigneeIds ?? [];
      return { ...f, assigneeIds: cur.includes(uid) ? cur.filter(id => id !== uid) : [...cur, uid] };
    });
  };

  const canEdit = isAdmin || (form?.assigneeIds ?? []).includes(currentUserId);

  const addTag = () => {
    const tag = tagInput.trim().replace(/,$/, '');
    if (tag && !form.tags.includes(tag)) setForm(f => ({ ...f, tags: [...f.tags, tag] }));
    setTagInput('');
  };

  if (!taskId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden animate-modal-in"
        style={{ background: 'var(--surface)', boxShadow: '0 24px 64px rgba(0,0,0,0.24)' }}
        onClick={e => e.stopPropagation()}
      >
        {loading || !task || !form ? (
          <div className="p-12 text-center">
            <IconSpin />
          </div>
        ) : (
          <>
            {/* ── Modal header ────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-4 shrink-0"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-1)' }}>Détail de la tâche</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {canEdit ? 'Vous pouvez modifier cette tâche.' : 'Mode lecture — non assigné.'}
                </p>
              </div>
              <button onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-1)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
                <IconX />
              </button>
            </div>

            {/* ── Scrollable body ─────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-5">

                {/* Read-only banner */}
                {!canEdit && (
                  <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl border"
                    style={{ background: 'var(--warning-bg)', borderColor: '#FDE68A', color: 'var(--warning)' }}>
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Lecture seule — vous n'êtes pas assigné à cette tâche.
                  </div>
                )}

                {/* Title */}
                <ModalField label="Titre">
                  <input
                    value={form.title}
                    onChange={e => canEdit && setForm({ ...form, title: e.target.value })}
                    readOnly={!canEdit}
                    className="w-full px-4 py-3 text-base font-semibold rounded-xl border outline-none transition-all"
                    style={{
                      background: canEdit ? 'var(--surface-2)' : 'var(--surface-2)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-1)',
                      cursor: canEdit ? 'text' : 'default',
                    }}
                    onFocus={e => canEdit && (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                </ModalField>

                {/* Description */}
                <ModalField label="Description">
                  <textarea
                    value={form.description}
                    onChange={e => canEdit && setForm({ ...form, description: e.target.value })}
                    readOnly={!canEdit}
                    rows={4}
                    className="w-full px-4 py-3 text-sm rounded-xl border outline-none resize-none transition-all"
                    style={{
                      background: 'var(--surface-2)', borderColor: 'var(--border)',
                      color: 'var(--text-1)', cursor: canEdit ? 'text' : 'default',
                    }}
                    onFocus={e => canEdit && (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                </ModalField>

                {/* Priority / Story Points / Status */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <ModalField label="Priorité">
                    <select
                      value={form.priority}
                      onChange={e => isAdmin && setForm({ ...form, priority: e.target.value })}
                      disabled={!isAdmin}
                      className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all"
                      style={{
                        background: 'var(--surface-2)', borderColor: 'var(--border)',
                        color: 'var(--text-1)', cursor: isAdmin ? 'pointer' : 'default',
                      }}>
                      <option value="low">Faible</option>
                      <option value="medium">Moyenne</option>
                      <option value="high">Haute</option>
                      <option value="critical">Critique</option>
                    </select>
                  </ModalField>

                  <ModalField label="Story Points">
                    <div className="flex gap-2">
                      <input
                        type="number" min="0" max="100"
                        value={form.storyPoints}
                        onChange={e => canEdit && setForm({ ...form, storyPoints: e.target.value })}
                        readOnly={!canEdit}
                        className="flex-1 px-3 py-2.5 text-sm rounded-xl border outline-none transition-all"
                        style={{
                          background: 'var(--surface-2)', borderColor: 'var(--border)',
                          color: 'var(--text-1)',
                        }}
                        onFocus={e => canEdit && (e.target.style.borderColor = 'var(--accent)')}
                        onBlur={e => e.target.style.borderColor = 'var(--border)'}
                      />
                      {isAdmin && (
                        <button type="button" onClick={handleEstimate} disabled={estimating}
                          title="Estimation IA"
                          className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium border transition-colors disabled:opacity-50"
                          style={{ background: 'var(--accent-light)', color: 'var(--accent)', borderColor: 'var(--accent)' }}>
                          {estimating ? <IconSpin /> : <IconAI />}
                          IA
                        </button>
                      )}
                    </div>
                  </ModalField>

                  <ModalField label="Statut">
                    <input value={task.status} disabled
                      className="w-full px-3 py-2.5 text-sm rounded-xl border"
                      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-2)' }} />
                  </ModalField>
                </div>

                {/* Assignees */}
                <ModalField label="Assigné à"
                  badge={form.assigneeIds?.length > 0 ? `${form.assigneeIds.length} sélectionné${form.assigneeIds.length > 1 ? 's' : ''}` : null}>
                  {isAdmin && members.length > 0 ? (
                    <div className="rounded-xl border overflow-hidden max-h-44 overflow-y-auto"
                      style={{ borderColor: 'var(--border)' }}>
                      {members.map(m => {
                        const checked = (form.assigneeIds ?? []).includes(m.userId);
                        const ini = m.fullName?.charAt(0)?.toUpperCase() ?? '?';
                        return (
                          <label key={m.userId}
                            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b last:border-0"
                            style={{
                              background: checked ? 'var(--accent-light)' : 'transparent',
                              borderColor: 'var(--border)',
                            }}
                            onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--surface-2)'; }}
                            onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <input type="checkbox" checked={checked}
                              onChange={() => toggleAssignee(m.userId)}
                              className="w-4 h-4 rounded"
                              style={{ accentColor: 'var(--accent)' }} />
                            <div className="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                              style={{ background: checked ? 'var(--accent)' : 'var(--text-3)' }}>
                              {ini}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>{m.fullName}</p>
                              <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{m.email}</p>
                            </div>
                            {checked && (
                              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                style={{ color: 'var(--accent)' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(task.assigneeNames ?? (task.assigneeName ? [task.assigneeName] : [])).length > 0
                        ? (task.assigneeNames ?? [task.assigneeName]).map((n, i) => (
                            <span key={i} className="text-xs px-2.5 py-1 rounded-full font-medium"
                              style={{ background: 'var(--accent-light)', color: 'var(--accent-text)' }}>
                              {n}
                            </span>
                          ))
                        : <span className="text-sm italic" style={{ color: 'var(--text-3)' }}>Non assigné</span>
                      }
                    </div>
                  )}
                </ModalField>

                {/* Tags */}
                <ModalField label="Tags">
                  {form?.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {form.tags.map((tag, i) => {
                        const c = TAG_COLORS[i % TAG_COLORS.length];
                        return (
                          <span key={i}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium"
                            style={{ background: c.bg, color: c.text }}>
                            {tag}
                            {isAdmin && (
                              <button type="button"
                                onClick={() => setForm(f => ({ ...f, tags: f.tags.filter((_, j) => j !== i) }))}
                                className="hover:opacity-70 leading-none ml-0.5">×</button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {isAdmin && (
                    <div className="flex gap-2">
                      <input type="text" placeholder="Ajouter un tag…"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => {
                          if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                            e.preventDefault(); addTag();
                          }
                        }}
                        className="flex-1 px-3 py-2 text-sm rounded-xl border outline-none transition-all"
                        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
                        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border)'}
                      />
                      <button type="button" onClick={addTag}
                        className="px-3 py-2 rounded-xl text-sm border transition-colors"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-2)', borderColor: 'var(--border)' }}>
                        + Ajouter
                      </button>
                    </div>
                  )}
                  {!isAdmin && form?.tags?.length === 0 && (
                    <p className="text-xs italic" style={{ color: 'var(--text-3)' }}>Aucun tag.</p>
                  )}
                </ModalField>

                {/* Action buttons */}
                <div className="flex gap-2 pt-1 flex-wrap">
                  {canEdit && (
                    <button onClick={handleSave} disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
                      style={{ background: 'var(--accent)' }}>
                      {saving ? <><IconSpin /> Enregistrement…</> : 'Enregistrer'}
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={handleDecompose} disabled={decomposing}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50"
                      style={{ background: 'var(--accent-light)', color: 'var(--accent)', borderColor: 'var(--accent)' }}>
                      {decomposing ? <><IconSpin /> Décomposition…</> : <><IconAI /> Décomposer</>}
                    </button>
                  )}
                  <button
                    onClick={async () => { setPdfLoading(true); try { await exportTaskPdf(taskId, form.title); } finally { setPdfLoading(false); } }}
                    disabled={pdfLoading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm border transition-colors disabled:opacity-50"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-2)', borderColor: 'var(--border)' }}>
                    {pdfLoading ? <IconSpin /> : <IconPdf />} PDF
                  </button>
                  {isAdmin && (
                    <button onClick={handleDelete}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm border transition-colors"
                      style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderColor: '#FCA5A5' }}>
                      <IconTrash /> Supprimer
                    </button>
                  )}
                </div>

                {/* AI sub-tasks panel */}
                {isAdmin && subTasks !== null && (
                  <div className="rounded-xl border overflow-hidden"
                    style={{ background: 'var(--accent-light)', borderColor: 'var(--accent)' }}>
                    <div className="flex items-center justify-between px-4 py-3"
                      style={{ borderBottom: '1px solid var(--accent)', opacity: 0.8 }}>
                      <div className="flex items-center gap-2">
                        <IconAI />
                        <span className="text-sm font-semibold" style={{ color: 'var(--accent-text)' }}>
                          Sous-tâches suggérées
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: 'var(--accent)', color: '#fff' }}>
                          {subTasks.length}
                        </span>
                      </div>
                      {subTasks.length > 0 && createdIdx.size < subTasks.length && (
                        <button onClick={handleCreateAll}
                          className="text-xs font-medium underline transition-opacity hover:opacity-70"
                          style={{ color: 'var(--accent-text)' }}>
                          Tout créer
                        </button>
                      )}
                    </div>
                    <div className="p-3 space-y-2">
                      {subTasks.length === 0
                        ? <p className="text-sm text-center py-3 italic" style={{ color: 'var(--text-3)' }}>
                            Aucune suggestion générée.
                          </p>
                        : subTasks.map((st, i) => (
                            <div key={i}
                              className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl"
                              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                              <span className={`text-sm flex-1 ${createdIdx.has(i) ? 'line-through opacity-40' : ''}`}
                                style={{ color: 'var(--text-1)' }}>
                                {st}
                              </span>
                              <button
                                onClick={() => handleCreateSubTask(st, i)}
                                disabled={creatingIdx.has(i) || createdIdx.has(i)}
                                className="text-xs px-3 py-1 rounded-lg font-medium border transition-colors shrink-0 disabled:opacity-50"
                                style={createdIdx.has(i)
                                  ? { background: 'var(--success-bg)', color: 'var(--success)', borderColor: '#86EFAC' }
                                  : { background: 'var(--accent-light)', color: 'var(--accent)', borderColor: 'var(--accent)' }
                                }>
                                {creatingIdx.has(i) ? '…' : createdIdx.has(i) ? '✓ Créée' : '+ Créer'}
                              </button>
                            </div>
                          ))
                      }
                    </div>
                  </div>
                )}
              </div>

              {/* ── Comments ──────────────────────────────────── */}
              <div className="px-6 pb-6" style={{ borderTop: '1px solid var(--border)' }}>
                <h3 className="text-sm font-semibold pt-5 mb-4" style={{ color: 'var(--text-1)' }}>
                  Commentaires
                  <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
                    {comments.length}
                  </span>
                </h3>

                <div className="space-y-3 mb-4 max-h-56 overflow-y-auto">
                  {comments.length === 0 && (
                    <p className="text-sm italic" style={{ color: 'var(--text-3)' }}>Aucun commentaire.</p>
                  )}
                  {comments.map(c => (
                    <div key={c.id} className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full text-white text-xs font-semibold flex items-center justify-center"
                            style={{ background: 'var(--accent)' }}>
                            {c.authorName?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                          <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{c.authorName}</span>
                          <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                            {new Date(c.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <button onClick={() => handleDeleteComment(c.id)}
                          className="text-xs transition-colors"
                          style={{ color: 'var(--text-3)' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
                          Supprimer
                        </button>
                      </div>
                      <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>{c.content}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input type="text" placeholder="Ajouter un commentaire…" value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    className="flex-1 px-4 py-2.5 text-sm rounded-xl border outline-none transition-all"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                  <button type="submit"
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                    style={{ background: 'var(--accent)' }}>
                    Publier
                  </button>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ModalField({ label, badge, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
          {label}
        </label>
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full normal-case font-medium"
            style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
