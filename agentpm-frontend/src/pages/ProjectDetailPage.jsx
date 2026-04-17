import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getProjectById,
  getProjectMembers,
  addMember,
  removeMember,
  updateProject
} from '../api/projectApi';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    getProjectById(id).then(p => {
      setProject(p);
      setForm({ name: p.name, description: p.description || '' });
    });
    getProjectMembers(id).then(setMembers);
  }, [id]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await addMember(id, { userId: newUserId, role: newRole });
      const updated = await getProjectMembers(id);
      setMembers(updated);
      setNewUserId('');
    } catch {
      setError('Erreur lors de l\'ajout du membre.');
    }
  };

  const handleRemoveMember = async (userId) => {
    await removeMember(id, userId);
    setMembers(members.filter(m => m.userId !== userId));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const updated = await updateProject(id, form);
    setProject(updated);
    setEditing(false);
  };

  if (!project) return <div className="p-8 text-gray-500">Chargement...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="text-indigo-600 mb-6 flex items-center gap-1 hover:underline"
        >
          ← Retour
        </button>

        {/* Project Info */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          {editing ? (
            <form onSubmit={handleUpdate}>
              <input
                className="w-full border rounded-lg px-3 py-2 mb-3 text-xl font-bold"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
              <textarea
                className="w-full border rounded-lg px-3 py-2 mb-3"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
              <div className="flex gap-3">
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg">
                  Sauvegarder
                </button>
                <button type="button" onClick={() => setEditing(false)} className="bg-gray-200 px-4 py-2 rounded-lg">
                  Annuler
                </button>
              </div>
            </form>
          ) : (
            <div className="flex justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{project.name}</h1>
                <p className="text-gray-500">{project.description || 'Pas de description'}</p>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="text-indigo-600 hover:underline text-sm"
              >
                Modifier
              </button>
            </div>
          )}
        </div>

        {/* Members */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Membres ({members.length})</h2>

          {error && <p className="text-red-500 mb-3 text-sm">{error}</p>}

          <form onSubmit={handleAddMember} className="flex gap-3 mb-6">
            <input
              type="text"
              placeholder="User ID"
              value={newUserId}
              onChange={e => setNewUserId(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              Ajouter
            </button>
          </form>

          <div className="space-y-3">
            {members.map(m => (
              <div key={m.userId} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{m.fullName}</p>
                  <p className="text-sm text-gray-500">{m.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
                    {m.role}
                  </span>
                  <button
                    onClick={() => handleRemoveMember(m.userId)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Retirer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}