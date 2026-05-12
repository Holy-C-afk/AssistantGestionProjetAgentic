import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getProjectById,
  getProjectMembers,
  addMemberByEmail,
  removeMember,
  updateProject,
  updateProjectStatus,
  downloadProjectPdf,
  getUsers,
} from '../api/projectApi';
import SprintSelector from '../components/SprintSelector';
import KanbanBoard from '../components/KanbanBoard';
import TaskDetailModal from '../components/TaskDetailModal';
import AgentPanel from '../components/AgentPanel';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [tab, setTab] = useState('board');
  const [selectedSprintId, setSelectedSprintId] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [boardRefreshKey,  setBoardRefreshKey]  = useState(0);
  const [sprintRefreshKey, setSprintRefreshKey] = useState(0);

  // member-picker state
  const [newRole, setNewRole] = useState('member');
  const [addingMember, setAddingMember] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null); // { id, email, fullName }

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    getProjectById(id).then(p => {
      setProject(p);
      setForm({ name: p.name, description: p.description || '' });
    }).catch(console.error);
    getProjectMembers(id).then(setMembers).catch(console.error);
  }, [id]);

  // Load all registered users whenever the Members tab is opened
  useEffect(() => {
    if (tab === 'members') {
      getUsers().then(setAllUsers).catch(console.error);
    }
  }, [tab]);

  const handleAddMember = async (e) => {
    e?.preventDefault();
    if (!selectedUser) return;
    setError('');
    setAddingMember(true);
    try {
      await addMemberByEmail(id, selectedUser.email, newRole);
      const updated = await getProjectMembers(id);
      setMembers(updated);
      setSelectedUser(null);
      setUserSearch('');
      setNewRole('member');
    } catch (err) {
      setError(err?.response?.data?.message || "Erreur lors de l'ajout du membre.");
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await removeMember(id, userId);
      setMembers(members.filter(m => m.userId !== userId));
    } catch (e) { console.error(e); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const updated = await updateProject(id, form);
      setProject(updated);
      setEditing(false);
    } catch (e) { console.error(e); }
  };

  const handleExportPdf = async () => {
    setPdfLoading(true);
    try {
      await downloadProjectPdf(id, project.name);
    } catch {
      setError('Erreur lors de la génération du PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!confirm(`Confirmer : passer le projet en « ${newStatus} » ?`)) return;
    try {
      const updated = await updateProjectStatus(id, newStatus);
      setProject(p => ({ ...p, status: updated.status }));
    } catch {
      setError('Erreur lors du changement de statut.');
    }
  };

  const refreshBoard = () => setBoardRefreshKey(k => k + 1);

  // Called by KanbanBoard / SprintSelector / TaskDetailModal when the backend
  // auto-closes a sprint, completes a project, reopens a sprint, or reactivates a project.
  const handleAutoRefresh = ({ sprintAutoClosed, projectAutoCompleted, sprintReopened, projectReactivated } = {}) => {
    if (sprintAutoClosed || sprintReopened) setSprintRefreshKey(k => k + 1);
    if (projectAutoCompleted || projectReactivated) getProjectById(id).then(p => setProject(p));
  };

  if (!project) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Chargement du projet…</p>
      </div>
    </div>
  );

  const STATUS_BADGE = {
    active:    'bg-green-100 text-green-700 border border-green-200',
    archived:  'bg-yellow-100 text-yellow-700 border border-yellow-200',
    completed: 'bg-blue-100 text-blue-700 border border-blue-200',
  };
  const STATUS_LABEL = { active: 'Actif', archived: 'Archivé', completed: 'Terminé' };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Project header ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-7xl mx-auto">

          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition mb-4">
            ← Retour aux projets
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm flex items-center gap-2">
              ⚠️ {error}
            </div>
          )}

          {editing ? (
            <form onSubmit={handleUpdate} className="space-y-3 max-w-xl">
              <input
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
              />
              <textarea
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2} placeholder="Description (optionnel)"
              />
              <div className="flex gap-2">
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition">Sauvegarder</button>
                <button type="button" onClick={() => setEditing(false)} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition">Annuler</button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[project.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABEL[project.status] ?? project.status}
                  </span>
                </div>
                <p className="text-gray-500 text-sm">{project.description || <span className="italic text-gray-400">Pas de description</span>}</p>
                <p className="text-xs text-gray-400 mt-2">
                  Créé le {new Date(project.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {' · '} <span className="font-medium">{members.length}</span> membre{members.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button onClick={() => setEditing(true)}
                  className="text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition">
                  ✏️ Modifier
                </button>
                {project.status !== 'archived' && (
                  <button onClick={() => handleStatusChange('archived')}
                    className="text-sm px-3 py-2 rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition">
                    📦 Archiver
                  </button>
                )}
                {project.status !== 'completed' && (
                  <button onClick={() => handleStatusChange('completed')}
                    className="text-sm px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition">
                    ✅ Terminer
                  </button>
                )}
                {(project.status === 'archived' || project.status === 'completed') && (
                  <button onClick={() => handleStatusChange('active')}
                    className="text-sm px-3 py-2 rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition">
                    ▶ Réactiver
                  </button>
                )}
                <button onClick={handleExportPdf} disabled={pdfLoading}
                  className="text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-indigo-600 transition disabled:opacity-50 flex items-center gap-1.5">
                  {pdfLoading
                    ? <><span className="w-4 h-4 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin inline-block" /> PDF…</>
                    : '📄 PDF'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-6 bg-gray-200/60 rounded-xl p-1 w-fit">
          {[{ k: 'board', l: '📋 Sprint Board' }, { k: 'members', l: `👥 Membres (${members.length})` }].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t.k
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}>
              {t.l}
            </button>
          ))}
        </div>

        {tab === 'board' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-1">
              <SprintSelector
                projectId={id}
                selectedSprintId={selectedSprintId}
                onSelect={setSelectedSprintId}
                refreshKey={sprintRefreshKey}
                onAutoRefresh={handleAutoRefresh}
              />
            </div>
            <div className="lg:col-span-3">
              <KanbanBoard
                sprintId={selectedSprintId}
                projectId={id}
                refreshKey={boardRefreshKey}
                onTaskClick={(task) => setSelectedTaskId(task.id)}
                onAutoRefresh={handleAutoRefresh}
              />
            </div>
          </div>
        )}

        {tab === 'members' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── Left: user picker ─────────────────────────────────────────── */}
            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                👥 Ajouter un utilisateur
              </h3>

              {/* Search box */}
              <div className="relative mb-3">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                <input
                  type="text"
                  placeholder="Rechercher par nom ou email…"
                  value={userSearch}
                  onChange={e => { setUserSearch(e.target.value); setSelectedUser(null); }}
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* User list (filtered, excluding already-members) */}
              {(() => {
                const memberIds = new Set(members.map(m => m.userId));
                const term = userSearch.trim().toLowerCase();
                const filtered = allUsers.filter(u =>
                  !memberIds.has(u.id) &&
                  (!term ||
                    u.fullName.toLowerCase().includes(term) ||
                    u.email.toLowerCase().includes(term))
                );

                return (
                  <div className="border border-gray-200 rounded-lg overflow-hidden mb-4 max-h-64 overflow-y-auto">
                    {filtered.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-6 italic">
                        {allUsers.length === 0
                          ? 'Aucun utilisateur enregistré.'
                          : 'Aucun résultat — tous sont déjà membres ou la recherche ne correspond pas.'}
                      </p>
                    ) : (
                      filtered.map(u => {
                        const initials = u.fullName
                          ? u.fullName.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
                          : u.email[0].toUpperCase();
                        const isSelected = selectedUser?.id === u.id;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => setSelectedUser(isSelected ? null : u)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition border-b border-gray-100 last:border-0
                              ${isSelected
                                ? 'bg-indigo-50 border-indigo-200'
                                : 'hover:bg-gray-50'}`}
                          >
                            <div className={`w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0
                              ${isSelected ? 'bg-indigo-600' : 'bg-gray-400'}`}>
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{u.fullName}</p>
                              <p className="text-xs text-gray-500 truncate">{u.email}</p>
                            </div>
                            {isSelected && (
                              <span className="text-indigo-600 text-xs font-semibold shrink-0">✓ Sélectionné</span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                );
              })()}

              {/* Role selector + Add button */}
              {selectedUser && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-3">
                  <p className="text-xs text-indigo-700 font-medium mb-2">
                    Ajouter <strong>{selectedUser.fullName}</strong> en tant que :
                  </p>
                  <div className="flex gap-2">
                    <select
                      value={newRole}
                      onChange={e => setNewRole(e.target.value)}
                      className="flex-1 border border-indigo-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="member">Membre</option>
                      <option value="admin">Admin</option>
                      <option value="viewer">Observateur</option>
                    </select>
                    <button
                      onClick={handleAddMember}
                      disabled={addingMember}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition"
                    >
                      {addingMember
                        ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                        : '+ Ajouter'}
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center">
                Seuls les utilisateurs connectés au moins une fois à AgentPM apparaissent.
              </p>
            </div>

            {/* ── Right: current members ────────────────────────────────────── */}
            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                ✅ Membres actuels
                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-normal">
                  {members.length}
                </span>
              </h3>

              <div className="space-y-2 max-h-[450px] overflow-y-auto">
                {members.length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-8">Aucun membre pour l'instant.</p>
                )}
                {members.map(m => {
                  const initials = m.fullName
                    ? m.fullName.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
                    : '?';
                  const roleColor = {
                    admin:  'bg-purple-100 text-purple-700',
                    member: 'bg-indigo-100 text-indigo-700',
                    viewer: 'bg-gray-100 text-gray-600',
                  }[m.role] ?? 'bg-gray-100 text-gray-600';

                  return (
                    <div key={m.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{m.fullName}</p>
                          <p className="text-xs text-gray-500">{m.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor}`}>{m.role}</span>
                        <button
                          onClick={() => handleRemoveMember(m.userId)}
                          className="text-gray-400 hover:text-red-500 transition text-sm p-1 rounded hover:bg-red-50"
                          title="Retirer du projet"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {selectedTaskId && (
          <TaskDetailModal
            taskId={selectedTaskId}
            members={members}
            onClose={() => setSelectedTaskId(null)}
            onUpdated={refreshBoard}
            onAutoRefresh={handleAutoRefresh}
          />
        )}

      </div>

      {/* Floating AI assistant — scoped to this project */}
      <AgentPanel projectId={id} />
    </div>
  );
}
