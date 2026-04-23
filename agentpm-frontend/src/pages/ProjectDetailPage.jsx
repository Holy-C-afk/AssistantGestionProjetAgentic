import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getProjectById,
  getProjectMembers,
  addMember,
  removeMember,
  updateProject,
  updateProjectStatus,
  downloadProjectPdf,
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
  const [boardRefreshKey, setBoardRefreshKey] = useState(0);

  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState('member');
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

  const handleAddMember = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await addMember(id, { userId: newUserId, role: newRole });
      const updated = await getProjectMembers(id);
      setMembers(updated);
      setNewUserId('');
    } catch (e) {
      setError(e?.response?.data?.message || "Erreur lors de l'ajout du membre.");
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await removeMember(id, userId);
      setMembers(members.filter(m => m.userId !== userId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const updated = await updateProject(id, form);
      setProject(updated);
      setEditing(false);
    } catch (e) {
      console.error(e);
    }
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

  if (!project) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">Chargement...</p>
    </div>
  );

  const statusStyles = {
    active: 'bg-green-100 text-green-700',
    archived: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="bg-gray-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">

        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-indigo-600 flex items-center gap-1 hover:underline text-sm"
          >
            ← Retour aux projets
          </button>
          <div className="flex items-center gap-2">
            {project?.status !== 'archived' && (
              <button
                onClick={() => handleStatusChange('archived')}
                className="bg-yellow-50 border border-yellow-300 text-yellow-700 px-4 py-2 rounded-lg text-sm hover:bg-yellow-100 transition"
              >
                📦 Archiver
              </button>
            )}
            {project?.status !== 'completed' && (
              <button
                onClick={() => handleStatusChange('completed')}
                className="bg-blue-50 border border-blue-300 text-blue-700 px-4 py-2 rounded-lg text-sm hover:bg-blue-100 transition"
              >
                ✅ Terminer
              </button>
            )}
            {(project?.status === 'archived' || project?.status === 'completed') && (
              <button
                onClick={() => handleStatusChange('active')}
                className="bg-green-50 border border-green-300 text-green-700 px-4 py-2 rounded-lg text-sm hover:bg-green-100 transition"
              >
                ▶ Réactiver
              </button>
            )}
            <button
              onClick={handleExportPdf}
              disabled={pdfLoading}
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 hover:border-indigo-400 hover:text-indigo-600 transition disabled:opacity-50"
            >
              {pdfLoading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
                  Génération...
                </>
              ) : (
                <>📄 Exporter PDF</>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow p-6 mb-6">
          {editing ? (
            <form onSubmit={handleUpdate}>
              <input
                className="w-full border rounded-lg px-3 py-2 mb-3 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
              />
              <textarea
                className="w-full border rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Description (optionnel)"
              />
              <div className="flex gap-3">
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                  Sauvegarder
                </button>
                <button type="button" onClick={() => setEditing(false)} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">
                  Annuler
                </button>
              </div>
            </form>
          ) : (
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusStyles[project.status] || 'bg-gray-100 text-gray-600'}`}>
                    {project.status}
                  </span>
                </div>
                <p className="text-gray-500">{project.description || 'Pas de description'}</p>
                <p className="text-xs text-gray-400 mt-3">
                  Créé le {new Date(project.createdAt).toLocaleDateString('fr-FR')}
                  {' • '}{project.memberCount} membre(s)
                </p>
              </div>
              <button onClick={() => setEditing(true)} className="text-indigo-600 hover:underline text-sm ml-4">
                Modifier
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {[
            { k: 'board', l: 'Sprint Board' },
            { k: 'members', l: 'Membres' },
          ].map(t => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
                tab === t.k
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
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
              />
            </div>
            <div className="lg:col-span-3">
              <KanbanBoard
                sprintId={selectedSprintId}
                projectId={id}
                refreshKey={boardRefreshKey}
                onTaskClick={(task) => setSelectedTaskId(task.id)}
              />
            </div>
          </div>
        )}

        {tab === 'members' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Membres ({members.length})</h2>
            <form onSubmit={handleAddMember} className="flex gap-3 mb-6 flex-wrap">
              <input
                type="text"
                placeholder="User ID (UUID)"
                value={newUserId}
                onChange={e => setNewUserId(e.target.value)}
                className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
                Ajouter
              </button>
            </form>
            <div className="space-y-2">
              {members.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-6">Aucun membre pour l'instant.</p>
              )}
              {members.map(m => (
                <div key={m.userId} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{m.fullName}</p>
                    <p className="text-xs text-gray-500">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">{m.role}</span>
                    <span className="text-xs text-gray-400">{new Date(m.joinedAt).toLocaleDateString('fr-FR')}</span>
                    <button onClick={() => handleRemoveMember(m.userId)} className="text-red-400 hover:text-red-600 text-sm">
                      Retirer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedTaskId && (
          <TaskDetailModal
            taskId={selectedTaskId}
            onClose={() => setSelectedTaskId(null)}
            onUpdated={refreshBoard}
          />
        )}

      </div>

      {/* Floating AI assistant — scoped to this project */}
      <AgentPanel projectId={id} />
    </div>
  );
}