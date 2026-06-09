import { useEffect, useState } from 'react';
import { getTask, updateTask, deleteTask, getTaskComments, addTaskComment, deleteTaskComment, createTask, exportTaskPdf } from '../api/taskApi';
import { agentEstimate, agentDecompose } from '../api/agentApi';
// Email is now sent server-side via SMTP in TaskController

export default function TaskDetailModal({ taskId, members = [], isAdmin = true, onClose, onUpdated, onAutoRefresh }) {
  const currentUserId = sessionStorage.getItem('userId');

  const [task, setTask]         = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [form, setForm]         = useState(null);
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  // AI state
  const [estimating, setEstimating]   = useState(false);
  const [decomposing, setDecomposing] = useState(false);
  const [subTasks, setSubTasks]       = useState(null);
  const [creatingIdx, setCreatingIdx] = useState(new Set());
  const [createdIdx, setCreatedIdx]   = useState(new Set());

  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    setSubTasks(null);
    setCreatingIdx(new Set());
    setCreatedIdx(new Set());
    Promise.all([getTask(taskId), getTaskComments(taskId)])
      .then(([t, c]) => {
        setTask(t);
        // Build effective assignee list (multi-assignee)
        const effectiveIds = (t.assigneeIds && t.assigneeIds.length > 0)
          ? t.assigneeIds
          : (t.assigneeId ? [t.assigneeId] : []);

        setForm({
          title: t.title,
          description: t.description || '',
          priority: t.priority,
          storyPoints: t.storyPoints ?? '',
          assigneeIds: effectiveIds,
          tags: t.tags ?? [],
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
        title:       form.title,
        description: form.description,
        priority:    form.priority,
        storyPoints: form.storyPoints === '' ? null : parseInt(form.storyPoints, 10),
        assigneeIds: form.assigneeIds ?? [],
        assigneeId:  form.assigneeIds?.[0] ?? null,
        tags:        form.tags ?? [],
      });

      // Backend returns { task } and sends the assignment email directly via SMTP
      const updated = result?.task ?? result;
      setTask(updated);
      onUpdated?.();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Supprimer cette tâche ?')) return;
    try {
      const result = await deleteTask(taskId);
      // Auto-close sprint / project may have been triggered
      if (result?.sprintAutoClosed || result?.projectAutoCompleted) {
        onAutoRefresh?.({
          sprintAutoClosed:    result.sprintAutoClosed,
          projectAutoCompleted: result.projectAutoCompleted,
        });
      }
      onUpdated?.();
      onClose();
    } catch (e) { console.error(e); }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      const authorId = sessionStorage.getItem('userId');
      const c = await addTaskComment(taskId, newComment.trim(), authorId);
      setComments([...comments, c]);
      setNewComment('');
    } catch (e) { console.error(e); }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await deleteTaskComment(taskId, commentId);
      setComments(comments.filter(c => c.id !== commentId));
    } catch (e) { console.error(e); }
  };

  // ── AI actions ──────────────────────────────────────────
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
    setDecomposing(true);
    setSubTasks(null);
    try {
      const { subTasks: list } = await agentDecompose(form.title, form.description);
      setSubTasks(list ?? []);
      setCreatedIdx(new Set());
    } catch (e) {
      console.error(e);
      setSubTasks([]);
    } finally { setDecomposing(false); }
  };

  const handleCreateSubTask = async (title, idx) => {
    if (!task) return;
    setCreatingIdx(s => new Set(s).add(idx));
    try {
      await createTask({ title, projectId: task.projectId, sprintId: task.sprintId ?? null, priority: 'medium' });
      setCreatedIdx(s => new Set(s).add(idx));
      onUpdated?.();
    } catch (e) { console.error(e); }
    finally { setCreatingIdx(s => { const n = new Set(s); n.delete(idx); return n; }); }
  };

  const handleCreateAll = async () => {
    if (!subTasks) return;
    for (let i = 0; i < subTasks.length; i++)
      if (!createdIdx.has(i)) await handleCreateSubTask(subTasks[i], i);
  };

  // canEdit: chef de projet (isAdmin) OR a collaborateur explicitly assigned to this task
  const canEdit = isAdmin || (form?.assigneeIds ?? []).includes(currentUserId);

  // Toggle one assignee in/out of the multi-assignee list (admin only UI, but defined here)
  const toggleAssignee = (uid) => {
    setForm(f => {
      const cur = f.assigneeIds ?? [];
      return { ...f, assigneeIds: cur.includes(uid) ? cur.filter(id => id !== uid) : [...cur, uid] };
    });
  };

  if (!taskId) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        {loading || !task || !form ? (
          <div className="p-10 text-center text-gray-400">Chargement...</div>
        ) : (
          <>
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Détail de la tâche</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-5">

              {/* Read-only banner for non-assigned collaborateurs */}
              {!canEdit && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded-lg">
                  <span>👁️</span>
                  <span>Mode lecture — vous n'êtes pas assigné à cette tâche.</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Titre</label>
                <input
                  value={form.title}
                  onChange={e => canEdit && setForm({ ...form, title: e.target.value })}
                  readOnly={!canEdit}
                  className={`w-full border rounded-lg px-3 py-2 text-lg font-semibold focus:outline-none ${canEdit ? 'border-gray-300 focus:ring-2 focus:ring-indigo-500' : 'border-gray-200 bg-gray-50 text-gray-600 cursor-default'}`}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => canEdit && setForm({ ...form, description: e.target.value })}
                  readOnly={!canEdit}
                  rows={4}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${canEdit ? 'border-gray-300 focus:ring-2 focus:ring-indigo-500' : 'border-gray-200 bg-gray-50 text-gray-600 cursor-default'}`}
                />
              </div>

              {/* Priority / Story Points / Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Priorité</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value })}
                    disabled={!isAdmin}
                    className={`w-full border rounded-lg px-3 py-2 text-sm ${!isAdmin ? 'bg-gray-50 text-gray-600 cursor-default border-gray-200' : 'border-gray-300'}`}
                  >
                    <option value="low">Basse</option>
                    <option value="medium">Moyenne</option>
                    <option value="high">Haute</option>
                    <option value="critical">Critique</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Story Points</label>
                  <div className="flex gap-2">
                    <input
                      type="number" min="0" max="100"
                      value={form.storyPoints}
                      onChange={e => canEdit && setForm({ ...form, storyPoints: e.target.value })}
                      readOnly={!canEdit}
                      className={`flex-1 border rounded-lg px-3 py-2 text-sm ${!canEdit ? 'bg-gray-50 text-gray-600 cursor-default border-gray-200' : 'border-gray-300'}`}
                    />
                    {isAdmin && (
                      <button type="button" onClick={handleEstimate} disabled={estimating} title="Estimation IA"
                        className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-2.5 rounded-lg text-sm hover:bg-indigo-100 disabled:opacity-50 transition whitespace-nowrap">
                        {estimating ? <span className="inline-block w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" /> : '🤖 Estimer'}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Statut</label>
                  <input value={task.status} disabled
                    className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500" />
                </div>
              </div>

              {/* ── Multi-assignee ── */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Assigné à{' '}
                  {form.assigneeIds?.length > 0 && (
                    <span className="normal-case font-normal text-indigo-600">
                      ({form.assigneeIds.length} sélectionné{form.assigneeIds.length > 1 ? 's' : ''})
                    </span>
                  )}
                </label>
                {isAdmin && members.length > 0 ? (
                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                    {members.map(m => {
                      const checked = (form.assigneeIds ?? []).includes(m.userId);
                      return (
                        <label key={m.userId}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-indigo-50 transition ${checked ? 'bg-indigo-50/60' : ''}`}>
                          <input type="checkbox" checked={checked}
                            onChange={() => toggleAssignee(m.userId)}
                            className="accent-indigo-600 w-4 h-4" />
                          <div className="w-7 h-7 rounded-full bg-indigo-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {m.fullName?.charAt(0)?.toUpperCase() ?? '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{m.fullName}</p>
                            <p className="text-xs text-gray-400 truncate">{m.email}</p>
                          </div>
                          {checked && <span className="text-indigo-500 text-xs font-semibold shrink-0">✓</span>}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(task.assigneeNames ?? (task.assigneeName ? [task.assigneeName] : [])).length > 0
                      ? (task.assigneeNames ?? [task.assigneeName]).map((n, i) => (
                          <span key={i} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full font-medium">
                            {n}
                          </span>
                        ))
                      : <span className="text-sm text-gray-400 italic">Non assigné</span>
                    }
                  </div>
                )}
              </div>

              {/* ── Tags ── */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tags</label>
                {form?.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {form.tags.map((tag, i) => {
                      const palette = [
                        'bg-violet-100 text-violet-700 border-violet-200',
                        'bg-teal-100 text-teal-700 border-teal-200',
                        'bg-pink-100 text-pink-700 border-pink-200',
                        'bg-amber-100 text-amber-700 border-amber-200',
                        'bg-cyan-100 text-cyan-700 border-cyan-200',
                        'bg-lime-100 text-lime-700 border-lime-200',
                      ];
                      return (
                        <span key={i} className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full border font-medium ${palette[i % palette.length]}`}>
                          {tag}
                          {isAdmin && (
                            <button type="button"
                              onClick={() => setForm(f => ({ ...f, tags: f.tags.filter((_, j) => j !== i) }))}
                              className="hover:opacity-70 leading-none">×</button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
                {isAdmin && (
                  <>
                    <div className="flex gap-2">
                      <input type="text" placeholder="Ajouter un tag..."
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => {
                          if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                            e.preventDefault();
                            const newTag = tagInput.trim().replace(/,$/, '');
                            if (newTag && !form.tags.includes(newTag))
                              setForm(f => ({ ...f, tags: [...f.tags, newTag] }));
                            setTagInput('');
                          }
                        }}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button type="button"
                        onClick={() => {
                          const newTag = tagInput.trim();
                          if (newTag && !form.tags.includes(newTag))
                            setForm(f => ({ ...f, tags: [...f.tags, newTag] }));
                          setTagInput('');
                        }}
                        className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-200 border border-gray-300">
                        + Ajouter
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Appuyez sur Entrée ou virgule pour ajouter</p>
                  </>
                )}
                {!isAdmin && form?.tags?.length === 0 && (
                  <p className="text-xs text-gray-400 italic">Aucun tag.</p>
                )}
              </div>

              {/* ── Action buttons ── */}
              <div className="flex gap-3 pt-2 flex-wrap">
                {canEdit && (
                  <button onClick={handleSave} disabled={saving}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                )}
                {isAdmin && (
                  <button onClick={handleDecompose} disabled={decomposing}
                    className="bg-purple-50 text-purple-700 border border-purple-200 px-4 py-2 rounded-lg text-sm hover:bg-purple-100 disabled:opacity-50 flex items-center gap-2 transition">
                    {decomposing
                      ? <><span className="inline-block w-4 h-4 border-2 border-purple-300 border-t-purple-700 rounded-full animate-spin" />Décomposition...</>
                      : '🤖 Décomposer en sous-tâches'}
                  </button>
                )}
                <button
                  onClick={async () => { setPdfLoading(true); try { await exportTaskPdf(taskId, form.title); } finally { setPdfLoading(false); } }}
                  disabled={pdfLoading}
                  className="bg-gray-50 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-100 border border-gray-200 flex items-center gap-1.5 disabled:opacity-50">
                  {pdfLoading ? <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin inline-block" /> : '📄'} PDF
                </button>
                {isAdmin && (
                  <button onClick={handleDelete}
                    className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-100 border border-red-200">
                    Supprimer
                  </button>
                )}
              </div>

              {/* AI sub-tasks panel — admin only */}
              {isAdmin && subTasks !== null && (
                <div className="mt-2 border border-purple-100 rounded-xl bg-purple-50/50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
                      🤖 Sous-tâches suggérées par l'IA
                      <span className="bg-purple-200 text-purple-700 text-xs px-2 py-0.5 rounded-full">{subTasks.length}</span>
                    </h4>
                    {subTasks.length > 0 && createdIdx.size < subTasks.length && (
                      <button onClick={handleCreateAll} className="text-xs text-purple-600 hover:text-purple-800 underline">
                        Tout créer
                      </button>
                    )}
                  </div>
                  {subTasks.length === 0
                    ? <p className="text-sm text-gray-400">Aucune suggestion générée.</p>
                    : <div className="space-y-2">
                        {subTasks.map((st, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 bg-white border border-purple-100 rounded-lg px-3 py-2">
                            <span className={`text-sm flex-1 ${createdIdx.has(i) ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{st}</span>
                            <button
                              onClick={() => handleCreateSubTask(st, i)}
                              disabled={creatingIdx.has(i) || createdIdx.has(i)}
                              className={`text-xs px-3 py-1 rounded-lg border transition shrink-0
                                ${createdIdx.has(i)
                                  ? 'bg-green-50 border-green-200 text-green-600 cursor-default'
                                  : 'bg-purple-100 border-purple-200 text-purple-700 hover:bg-purple-200 disabled:opacity-50'}`}
                            >
                              {creatingIdx.has(i) ? '...' : createdIdx.has(i) ? '✓ Créée' : '+ Créer'}
                            </button>
                          </div>
                        ))}
                      </div>
                  }
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="border-t border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Commentaires ({comments.length})</h3>
              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                {comments.length === 0 && <p className="text-sm text-gray-400 italic">Aucun commentaire.</p>}
                {comments.map(c => (
                  <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center">
                          {c.authorName?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{c.authorName}</span>
                        <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString('fr-FR')}</span>
                      </div>
                      <button onClick={() => handleDeleteComment(c.id)} className="text-gray-400 hover:text-red-500 text-xs">
                        Supprimer
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input type="text" placeholder="Ajouter un commentaire..." value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
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
