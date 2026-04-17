import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyProjects, createProject } from '../api/projectApi';
import { useProjectStore } from '../stores/projectStore';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, setProjects } = useProjectStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyProjects().then(setProjects).catch(console.error);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const newProject = await createProject(form);
      setProjects([...projects, newProject]);
      setShowForm(false);
      setForm({ name: '', description: '' });
    } catch (err) {
      setError('Erreur lors de la création du projet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Mes Projets</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            + Nouveau Projet
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl shadow mb-6">
            <h2 className="text-lg font-semibold mb-4">Créer un projet</h2>
            {error && <p className="text-red-500 mb-3">{error}</p>}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Création...' : 'Créer'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.length === 0 && (
            <p className="text-gray-500 col-span-2 text-center py-12">
              Aucun projet pour l'instant.
            </p>
          )}
          {projects.map(project => (
            <div
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="bg-white p-6 rounded-xl shadow cursor-pointer hover:shadow-md transition"
            >
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-lg font-semibold text-gray-900">{project.name}</h2>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  project.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {project.status}
                </span>
              </div>
              <p className="text-gray-500 text-sm mb-4">{project.description || 'Pas de description'}</p>
              <p className="text-xs text-gray-400">{project.memberCount} membre(s)</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}