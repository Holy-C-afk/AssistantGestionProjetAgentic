import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyProjects, createProject } from '../api/projectApi';

const PAGE_SIZE = 6;

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (current > 3) pages.push('...');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

export default function ProjectsPage() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchProjects = useCallback(async () => {
    setFetching(true);
    setError('');
    try {
      const data = await getMyProjects({
        page,
        pageSize: PAGE_SIZE,
        ...(status ? { status } : {}),
        ...(search ? { search } : {}),
      });
      // handle both paginated {items,total} and legacy flat array
      if (Array.isArray(data)) {
        setProjects(data);
        setTotal(data.length);
      } else {
        setProjects(Array.isArray(data?.items) ? data.items : []);
        setTotal(typeof data?.total === 'number' ? data.total : 0);
      }
    } catch (err) {
      console.error(err);
      setError('Impossible de charger les projets. Vérifiez que le backend est démarré.');
      setProjects([]);
      setTotal(0);
    } finally {
      setFetching(false);
    }
  }, [page, status, search]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setSearchInput('');
    setStatus('');
    setPage(1);
  };

  const handleStatusChange = (val) => {
    setStatus(val);
    setPage(1);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await createProject(form);
      setShowForm(false);
      setForm({ name: '', description: '' });
      setPage(1);
      await fetchProjects();
    } catch (err) {
      console.error(err);
      setError('Erreur lors de la création du projet.');
    } finally {
      setLoading(false);
    }
  };

  const statusStyles = {
    active: 'bg-green-100 text-green-700',
    archived: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mes Projets</h1>
            <p className="text-sm text-gray-500 mt-1">Gérez vos projets et leurs équipes</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm"
          >
            {showForm ? 'Annuler' : '+ Nouveau Projet'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl shadow mb-6">
            <h2 className="text-lg font-semibold mb-4">Créer un projet</h2>
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
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer'}
            </button>
          </form>
        )}

        <div className="bg-white rounded-xl shadow p-4 mb-6 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700"
            >
              Rechercher
            </button>
          </form>

          <div className="flex gap-2 flex-wrap">
            {[
              { v: '', l: 'Tous' },
              { v: 'active', l: 'Actif' },
              { v: 'archived', l: 'Archivé' },
              { v: 'completed', l: 'Terminé' },
            ].map(s => (
              <button
                key={s.v}
                type="button"
                onClick={() => handleStatusChange(s.v)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                  status === s.v
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {s.l}
              </button>
            ))}
          </div>

          {(search || status) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-gray-500 px-3 py-2 rounded-lg text-sm hover:bg-gray-100 border border-gray-300"
            >
              Effacer filtres
            </button>
          )}
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {fetching ? 'Chargement...' : `${total} projet(s) trouvé(s)`}
          {search && <span className="ml-1">pour « {search} »</span>}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {!fetching && projects.length === 0 && (
            <div className="col-span-full text-center py-16">
              <p className="text-gray-400 text-sm">Aucun projet trouvé.</p>
            </div>
          )}

          {projects.map(project => (
            <div
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="bg-white p-5 rounded-xl shadow cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-base font-semibold text-gray-900 leading-tight">
                  {project.name}
                </h2>
                <span className={`text-xs px-2 py-1 rounded-full ml-2 shrink-0 ${
                  statusStyles[project.status] || 'bg-gray-100 text-gray-600'
                }`}>
                  {project.status}
                </span>
              </div>
              <p className="text-gray-400 text-sm mb-4 min-h-[2.5rem]" style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {project.description || 'Pas de description'}
              </p>
              <div className="flex justify-between items-center text-xs text-gray-400">
                <span>{project.memberCount ?? 0} membre(s)</span>
                <span>{project.createdAt ? new Date(project.createdAt).toLocaleDateString('fr-FR') : ''}</span>
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 flex-wrap">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Précédent
            </button>

            {getPageNumbers(page, totalPages).map((item, idx) =>
              item === '...' ? (
                <span key={`e-${idx}`} className="px-2 text-gray-400">…</span>
              ) : (
                <button
                  key={item}
                  onClick={() => setPage(item)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium border transition ${
                    page === item
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {item}
                </button>
              )
            )}

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Suivant →
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
