import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyProjects, createProject } from '../api/projectApi';

const PAGE_SIZE = 9;

const ACCENT_TW = [
  'from-indigo-500 to-indigo-700',
  'from-violet-500 to-violet-700',
  'from-sky-500 to-sky-700',
  'from-emerald-500 to-emerald-700',
  'from-rose-500 to-rose-700',
  'from-amber-500 to-amber-600',
  'from-teal-500 to-teal-700',
  'from-pink-500 to-pink-700',
];
const accentClass = (name = '') => ACCENT_TW[name.charCodeAt(0) % ACCENT_TW.length];

const STATUS_CFG = {
  active:    { label: 'Actif',    bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  archived:  { label: 'Archivé', bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400'   },
  completed: { label: 'Terminé', bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400'    },
};

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (current > 3) pages.push('...');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

// ─── Icons ──────────────────────────────────────────────────────────────────
const IconSearch = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const IconPlus = ({ size = 4 }) => (
  <svg className={`w-${size} h-${size}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
  </svg>
);
const IconFolder = () => (
  <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  </svg>
);
const IconUsers = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconCalendar = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const IconWarn = () => (
  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);

// ─── Main page ───────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const navigate  = useNavigate();
  const userName  = sessionStorage.getItem('userName') || '';
  const firstName = userName.split(' ')[0];

  const [projects,    setProjects]    = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [status,      setStatus]      = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showModal,   setShowModal]   = useState(false);
  const [form,        setForm]        = useState({ name: '', description: '' });
  const [loading,     setLoading]     = useState(false);
  const [fetching,    setFetching]    = useState(true);
  const [error,       setError]       = useState('');

  const totalPages     = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeCount    = projects.filter(p => p.status === 'active').length;
  const completedCount = projects.filter(p => p.status === 'completed').length;

  const fetchProjects = useCallback(async () => {
    setFetching(true); setError('');
    try {
      const data = await getMyProjects({
        page, pageSize: PAGE_SIZE,
        ...(status ? { status } : {}),
        ...(search ? { search } : {}),
      });
      if (Array.isArray(data)) { setProjects(data); setTotal(data.length); }
      else {
        setProjects(Array.isArray(data?.items) ? data.items : []);
        setTotal(typeof data?.total === 'number' ? data.total : 0);
      }
    } catch (err) {
      console.error('[ProjectsPage] fetchProjects failed:', err?.response?.status, err?.response?.data, err?.message, err);
      setError('Impossible de charger les projets. Vérifiez que le backend est démarré.');
      setProjects([]); setTotal(0);
    } finally { setFetching(false); }
  }, [page, status, search]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleSearch = (e) => { e.preventDefault(); setSearch(searchInput); setPage(1); };
  const handleClear  = () => { setSearch(''); setSearchInput(''); setStatus(''); setPage(1); };
  const handleCreate = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await createProject(form);
      setShowModal(false); setForm({ name: '', description: '' }); setPage(1);
      await fetchProjects();
    } catch { setError('Erreur lors de la création du projet.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ══ HERO ═══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">

        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.045]"
          style={{ backgroundImage: 'radial-gradient(#a5b4fc 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        {/* Glow blobs */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-violet-600/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 pt-11 pb-16">
          <p className="text-indigo-300 text-sm font-medium tracking-wide mb-1.5">
            {firstName ? `Bonjour, ${firstName} 👋` : 'Bienvenue 👋'}
          </p>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mb-1.5">Mes projets</h1>
          <p className="text-slate-400 text-sm mb-9">Pilotez et suivez tous vos projets en un seul endroit.</p>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-3">
            {[
              { n: total,          l: 'Total',    c: 'text-white'       },
              { n: activeCount,    l: 'Actifs',   c: 'text-emerald-400' },
              { n: completedCount, l: 'Terminés', c: 'text-sky-400'     },
            ].map(s => (
              <div key={s.l}
                className="flex items-center gap-3 bg-white/[0.07] backdrop-blur-sm border border-white/10 rounded-2xl px-5 py-3 select-none">
                <span className={`text-2xl font-bold ${s.c}`}>{s.n}</span>
                <span className="text-slate-400 text-sm">{s.l}</span>
              </div>
            ))}

            {/* New project CTA */}
            <button
              onClick={() => setShowModal(true)}
              className="sm:ml-auto flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg shadow-indigo-900/50 hover:shadow-indigo-700/50 hover:-translate-y-0.5 active:scale-95 transition-all duration-150"
            >
              <IconPlus />
              Nouveau projet
            </button>
          </div>
        </div>
      </section>

      {/* ══ CONTENT ════════════════════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-6 py-7">

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 text-sm flex items-center gap-2.5">
            <IconWarn /> {error}
          </div>
        )}

        {/* ── Filter bar ──────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder="Rechercher un projet…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && handleClear()}
                className="w-full border border-gray-200 rounded-xl pl-10 pr-3 py-2.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>
            {searchInput && (
              <button type="submit"
                className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition shrink-0 shadow-sm">
                Chercher
              </button>
            )}
          </form>

          {/* Status pills */}
          <div className="flex gap-1.5 flex-wrap">
            {[
              { v: '',          l: 'Tous'     },
              { v: 'active',    l: 'Actifs'   },
              { v: 'completed', l: 'Terminés' },
              { v: 'archived',  l: 'Archivés' },
            ].map(s => (
              <button key={s.v}
                onClick={() => { setStatus(s.v); setPage(1); }}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-medium border transition-all shadow-sm ${
                  status === s.v
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                }`}>
                {s.l}
              </button>
            ))}
            {(search || status) && (
              <button onClick={handleClear}
                className="px-3 py-2.5 rounded-xl text-xs text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 shadow-sm transition">
                ✕ Effacer
              </button>
            )}
          </div>
        </div>

        {/* Result count */}
        <p className="text-xs text-gray-400 mb-5">
          {fetching ? '…' : `${total} projet${total !== 1 ? 's' : ''}${search ? ` · « ${search} »` : ''}`}
        </p>

        {/* ── Grid ────────────────────────────────────────────────────── */}
        {fetching ? (
          <SkeletonGrid />
        ) : projects.length === 0 ? (
          <EmptyState search={search} onCreate={() => setShowModal(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => navigate(`/projects/${project.id}`)}
              />
            ))}
          </div>
        )}

        {/* ── Pagination ──────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-1.5 mt-10">
            <PagBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>←</PagBtn>
            {getPageNumbers(page, totalPages).map((item, i) =>
              item === '...' ? (
                <span key={`e${i}`} className="px-2 text-gray-400 text-sm">…</span>
              ) : (
                <PagBtn key={item} onClick={() => setPage(item)} active={page === item}>{item}</PagBtn>
              )
            )}
            <PagBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>→</PagBtn>
          </div>
        )}
      </div>

      {/* ══ CREATE MODAL ═══════════════════════════════════════════════════ */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            style={{ animation: 'popIn .22s cubic-bezier(.34,1.56,.64,1)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Gradient header */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Nouveau projet</h2>
                <p className="text-indigo-200 text-xs mt-0.5">Remplissez les informations ci-dessous</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white text-xl leading-none transition"
              >×</button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Nom du projet <span className="text-red-400 normal-case tracking-normal font-normal">*</span>
                </label>
                <input
                  type="text" required autoFocus
                  placeholder="Ex : Refonte site web"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Description <span className="text-gray-400 normal-case font-normal tracking-normal">(optionnel)</span>
                </label>
                <textarea
                  placeholder="Décrivez brièvement le projet…"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition"
                  rows={3}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
                  <IconWarn /> {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="submit"
                  disabled={loading || !form.name.trim()}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition shadow-sm">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Création…
                    </span>
                  ) : 'Créer le projet'}
                </button>
                <button type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-3 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1)   translateY(0);    }
        }
      `}</style>
    </div>
  );
}

// ─── Project card ────────────────────────────────────────────────────────────
function ProjectCard({ project, onClick }) {
  const grad   = accentClass(project.name);
  const status = STATUS_CFG[project.status] ?? { label: project.status, bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' };
  const initials = project.name.slice(0, 2).toUpperCase();
  const date = project.createdAt
    ? new Date(project.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    : null;

  return (
    <div
      onClick={onClick}
      className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-indigo-100/70 hover:-translate-y-1.5 transition-all duration-200 cursor-pointer overflow-hidden"
    >
      {/* Gradient header band */}
      <div className={`relative h-28 bg-gradient-to-br ${grad} overflow-hidden`}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '18px 18px' }} />

        {/* Status badge top-right */}
        <div className="absolute top-3 right-3">
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm ${status.bg} ${status.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>
      </div>

      {/* Floating avatar (half outside header) */}
      <div className="absolute left-5 top-14">
        <div className="w-16 h-16 rounded-2xl bg-white shadow-lg ring-2 ring-gray-100 flex items-center justify-center text-lg font-bold text-gray-700 select-none group-hover:ring-indigo-200 transition">
          {initials}
        </div>
      </div>

      {/* Card body */}
      <div className="pt-11 px-5 pb-5">
        <h2 className="font-bold text-gray-900 text-[15px] leading-snug mb-1.5 group-hover:text-indigo-700 transition-colors line-clamp-1">
          {project.name}
        </h2>
        <p className="text-gray-400 text-sm line-clamp-2 leading-relaxed" style={{ minHeight: '2.5rem' }}>
          {project.description || 'Aucune description'}
        </p>

        {/* Footer meta */}
        <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-gray-100 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <IconUsers />
            {project.memberCount ?? 0} membre{(project.memberCount ?? 0) !== 1 ? 's' : ''}
          </span>
          {date && (
            <span className="flex items-center gap-1">
              <IconCalendar /> {date}
            </span>
          )}
        </div>
      </div>

      {/* Right-edge accent bar (appears on hover) */}
      <div className={`absolute top-0 right-0 w-1 h-full bg-gradient-to-b ${grad} opacity-0 group-hover:opacity-100 transition-opacity duration-200`} />
    </div>
  );
}

// ─── Skeleton grid ───────────────────────────────────────────────────────────
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
          <div className="h-28 bg-gradient-to-br from-gray-100 to-gray-150" />
          <div className="pt-11 px-5 pb-5 space-y-3">
            <div className="h-4 bg-gray-100 rounded-lg w-3/4" />
            <div className="h-3 bg-gray-100 rounded-lg w-full" />
            <div className="h-3 bg-gray-100 rounded-lg w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ search, onCreate }) {
  return (
    <div className="text-center py-24 px-6">
      <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-inner">
        <IconFolder />
      </div>
      <h3 className="text-lg font-semibold text-gray-800 mb-1.5">
        {search ? `Aucun résultat pour « ${search} »` : "Aucun projet pour l'instant"}
      </h3>
      <p className="text-sm text-gray-400 mb-7">
        {search ? 'Essayez un autre terme de recherche.' : 'Créez votre premier projet pour commencer.'}
      </p>
      {!search && (
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm"
        >
          <IconPlus size={3.5} /> Créer un projet
        </button>
      )}
    </div>
  );
}

// ─── Pagination button ───────────────────────────────────────────────────────
function PagBtn({ children, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-w-[2.25rem] h-9 px-3 rounded-xl text-sm font-medium border shadow-sm transition ${
        active
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed'
      }`}
    >
      {children}
    </button>
  );
}
