import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getMyProjects, createProject, deleteProject, updateProjectStatus } from '../api/projectApi';

const PAGE_SIZE = 9;
const FAV_KEY   = 'agentpm_fav_projects';

// Deterministic accent per project (warm palette, no pure purple-blue)
const ACCENTS = [
  '#0E7490','#0F766E','#B45309','#7C3AED','#BE185D',
  '#1D4ED8','#15803D','#9333EA','#C2410C','#0369A1',
];
const projectAccent = (name = '') => ACCENTS[name.charCodeAt(0) % ACCENTS.length];

/* ── Favourites helpers (localStorage) ─────────────────────────── */
const getFavs = () => {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
};
const toggleFav = (id) => {
  const favs = getFavs();
  const next = favs.includes(id) ? favs.filter(f => f !== id) : [...favs, id];
  localStorage.setItem(FAV_KEY, JSON.stringify(next));
  return next;
};

/* ── Relative time helper ───────────────────────────────────────── */
function relativeTime(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60)  return 'À l\'instant';
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return `Il y a ${m} min`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `Il y a ${h}h`;
  }
  if (diff < 86400 * 7) {
    const day = Math.floor(diff / 86400);
    return `Il y a ${day}j`;
  }
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (current > 3) pages.push('...');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

/* ── SVG icons (no emoji) ───────────────────────────────────────── */
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
  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-3)' }}>
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
const IconTrash = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const IconAlert = () => (
  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);
const IconX = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IconGrid = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);
const IconList = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const IconStar = ({ filled }) => (
  <svg className="w-3.5 h-3.5" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);
const IconArchive = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
  </svg>
);
const IconClock = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

/* ── Main page ──────────────────────────────────────────────────── */
export default function ProjectsPage() {
  const navigate  = useNavigate();
  const { t }     = useTranslation();
  const userName  = sessionStorage.getItem('userName') || '';
  const firstName = userName.split(' ')[0];

  const [projects,    setProjects]    = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [status,      setStatus]      = useState('');
  const [sortBy,      setSortBy]      = useState('date');
  const [viewMode,    setViewMode]    = useState(() => localStorage.getItem('agentpm_view') || 'grid');
  const [favIds,      setFavIds]      = useState(() => getFavs());
  const [searchInput, setSearchInput] = useState('');
  const [refreshKey,  setRefreshKey]  = useState(0);
  const [showModal,    setShowModal]    = useState(false);
  const [form,         setForm]         = useState({ name: '', description: '' });
  const [loading,      setLoading]      = useState(false);
  const [fetching,     setFetching]     = useState(true);
  const [error,        setError]        = useState('');
  const [deletingId,   setDeletingId]   = useState(null);
  const [confirmId,    setConfirmId]    = useState(null);
  const [archivingId,  setArchivingId]  = useState(null);

  // Debounce: update `search` 300ms after the user stops typing
  const debounceRef = useRef(null);
  const handleSearchInput = (val) => {
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    if (val === '') {
      setSearch('');
      setPage(1);
    } else {
      debounceRef.current = setTimeout(() => {
        setSearch(val);
        setPage(1);
      }, 300);
    }
  };

  // Persist view mode
  const setView = (v) => { setViewMode(v); localStorage.setItem('agentpm_view', v); };

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
      setError(t('projects.errors.load'));
      setProjects([]); setTotal(0);
    } finally { setFetching(false); }
  }, [page, status, search, refreshKey, t]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleSearch = (e) => { e.preventDefault(); setSearch(searchInput); setPage(1); };
  const handleClear  = () => {
    clearTimeout(debounceRef.current);
    setSearch(''); setSearchInput(''); setStatus(''); setPage(1);
  };
  const handleCreate = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await createProject(form);
      setShowModal(false);
      setForm({ name: '', description: '' });
      setPage(1);
      setRefreshKey(k => k + 1);
    } catch { setError(t('projects.errors.create')); }
    finally { setLoading(false); }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmId) return;
    setDeletingId(confirmId); setConfirmId(null);
    try {
      await deleteProject(confirmId);
      await fetchProjects();
    } catch { setError(t('projects.errors.delete')); }
    finally { setDeletingId(null); }
  };

  const handleArchive = async (id) => {
    setArchivingId(id);
    try {
      await updateProjectStatus(id, 'archived');
      setRefreshKey(k => k + 1);
    } catch (e) {
      setError(e?.response?.data?.message || 'Erreur lors de l\'archivage.');
    }
    finally { setArchivingId(null); }
  };

  const handleToggleFav = (id) => {
    const next = toggleFav(id);
    setFavIds(next);
  };

  const sortedProjects = (() => {
    const favs = [...projects].filter(p => favIds.includes(p.id));
    const rest  = [...projects].filter(p => !favIds.includes(p.id));
    const sorter = (a, b) => {
      if (sortBy === 'name')     return a.name.localeCompare(b.name);
      if (sortBy === 'members')  return (b.memberCount ?? 0) - (a.memberCount ?? 0);
      if (sortBy === 'progress') {
        const pa = a.taskTotal > 0 ? a.taskDone / a.taskTotal : 0;
        const pb = b.taskTotal > 0 ? b.taskDone / b.taskTotal : 0;
        return pb - pa;
      }
      if (sortBy === 'activity') return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      return new Date(b.createdAt) - new Date(a.createdAt);
    };
    return [...favs.sort(sorter), ...rest.sort(sorter)];
  })();

  const statusFilters = [
    { v: '',          l: t('projects.all')       },
    { v: 'active',    l: t('projects.active')    },
    { v: 'completed', l: t('projects.completed') },
    { v: 'archived',  l: t('projects.archived')  },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* ── Page header ─────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <p className="text-sm font-medium mb-1.5" style={{ color: 'var(--accent)' }}>
                {firstName ? t('projects.greeting', { name: firstName }) : t('projects.welcome')}
              </p>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
                {t('projects.title')}
              </h1>
              <div className="flex items-center gap-5 mt-3">
                <Stat n={total}          label={t('projects.total')}     />
                <div className="w-px h-5" style={{ background: 'var(--border)' }} />
                <Stat n={activeCount}    label={t('projects.active')}    color="var(--success)"  />
                <div className="w-px h-5" style={{ background: 'var(--border)' }} />
                <Stat n={completedCount} label={t('projects.completed')} color="var(--accent)"   />
                {favIds.length > 0 && (
                  <>
                    <div className="w-px h-5" style={{ background: 'var(--border)' }} />
                    <Stat n={favIds.length} label="Favoris" color="#D97706" />
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 active:scale-[0.98] shrink-0"
              style={{ background: 'var(--accent)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-h)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
            >
              <IconPlus /> {t('projects.new')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-7">

        {error && (
          <div className="flex items-center gap-2.5 text-sm px-4 py-3 rounded-xl mb-5 border"
            style={{ background: 'var(--danger-bg)', borderColor: '#FCA5A5', color: 'var(--danger)' }}>
            <IconAlert /> {error}
          </div>
        )}

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex gap-2 flex-1">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-3)' }}>
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder={t('projects.searchPlaceholder')}
                value={searchInput}
                onChange={e => handleSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && handleClear()}
                className="w-full pl-10 pr-9 py-2.5 text-sm rounded-xl border outline-none transition-all"
                style={{
                  background: 'var(--surface)', borderColor: 'var(--border)',
                  color: 'var(--text-1)',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              {searchInput && (
                <button
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full transition-colors"
                  style={{ color: 'var(--text-3)' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-1)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
                >
                  <IconX />
                </button>
              )}
            </div>
          </div>

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-3 py-2.5 rounded-xl text-xs border outline-none transition-all shrink-0"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-2)' }}
          >
            <option value="date">↓ Date création</option>
            <option value="activity">↓ Activité récente</option>
            <option value="name">A → Z</option>
            <option value="members">Membres</option>
            <option value="progress">Progression</option>
          </select>

          {/* View toggle */}
          <div className="flex rounded-xl border overflow-hidden shrink-0"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <button
              onClick={() => setView('grid')}
              title="Vue grille"
              className="px-3 py-2.5 transition-colors"
              style={viewMode === 'grid'
                ? { background: 'var(--accent)', color: '#fff' }
                : { color: 'var(--text-3)', background: 'transparent' }}>
              <IconGrid />
            </button>
            <button
              onClick={() => setView('list')}
              title="Vue liste"
              className="px-3 py-2.5 transition-colors"
              style={viewMode === 'list'
                ? { background: 'var(--accent)', color: '#fff' }
                : { color: 'var(--text-3)', background: 'transparent' }}>
              <IconList />
            </button>
          </div>

          {/* Status pills */}
          <div className="flex gap-1.5 flex-wrap">
            {statusFilters.map(s => (
              <button key={s.v}
                onClick={() => { setStatus(s.v); setPage(1); }}
                className="px-3.5 py-2.5 rounded-xl text-xs font-medium border transition-all"
                style={status === s.v
                  ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
                  : { background: 'var(--surface)', color: 'var(--text-2)', borderColor: 'var(--border)' }
                }>
                {s.l}
              </button>
            ))}
            {(search || status) && (
              <button onClick={handleClear}
                className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs border transition-colors"
                style={{ background: 'var(--surface)', color: 'var(--text-3)', borderColor: 'var(--border)' }}>
                <IconX /> {t('projects.clearFilter')}
              </button>
            )}
          </div>
        </div>

        {/* Result count */}
        <p className="text-xs mb-5" style={{ color: 'var(--text-3)' }}>
          {fetching ? '…' : `${total} ${total !== 1 ? t('projects.resultCount_plural', { count: total }) : t('projects.resultCount', { count: total })}${search ? t('projects.resultSearch', { term: search }) : ''}`}
        </p>

        {/* Grid / List */}
        {fetching ? (
          viewMode === 'grid' ? <SkeletonGrid /> : <SkeletonList />
        ) : projects.length === 0 ? (
          <EmptyState search={search} onCreate={() => setShowModal(true)} t={t} />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedProjects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                isFav={favIds.includes(project.id)}
                onClick={() => navigate(`/projects/${project.id}`)}
                onDelete={e => { e.stopPropagation(); setConfirmId(project.id); }}
                onToggleFav={e => { e.stopPropagation(); handleToggleFav(project.id); }}
                onArchive={e => { e.stopPropagation(); handleArchive(project.id); }}
                isDeleting={deletingId === project.id}
                isArchiving={archivingId === project.id}
                t={t}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sortedProjects.map(project => (
              <ProjectRow
                key={project.id}
                project={project}
                isFav={favIds.includes(project.id)}
                onClick={() => navigate(`/projects/${project.id}`)}
                onDelete={e => { e.stopPropagation(); setConfirmId(project.id); }}
                onToggleFav={e => { e.stopPropagation(); handleToggleFav(project.id); }}
                onArchive={e => { e.stopPropagation(); handleArchive(project.id); }}
                isDeleting={deletingId === project.id}
                isArchiving={archivingId === project.id}
                t={t}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-1.5 mt-10">
            <PagBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>←</PagBtn>
            {getPageNumbers(page, totalPages).map((item, i) =>
              item === '...' ? (
                <span key={`e${i}`} className="px-2 text-sm" style={{ color: 'var(--text-3)' }}>…</span>
              ) : (
                <PagBtn key={item} onClick={() => setPage(item)} active={page === item}>{item}</PagBtn>
              )
            )}
            <PagBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>→</PagBtn>
          </div>
        )}
      </div>

      {/* ── Create modal ─────────────────────────────────────────── */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <ModalHeader
            title={t('projects.createModal.title')}
            subtitle={t('projects.createModal.subtitle')}
            onClose={() => setShowModal(false)}
          />
          <form onSubmit={handleCreate} className="p-6 space-y-4">
            <Field label={t('common.name')} required>
              <input
                type="text" required autoFocus
                placeholder={t('projects.createModal.namePlaceholder')}
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 text-sm rounded-xl border outline-none transition-all"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </Field>
            <Field label={t('common.description')} hint={t('common.optional')}>
              <textarea
                placeholder={t('projects.createModal.descPlaceholder')}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-3 text-sm rounded-xl border outline-none resize-none transition-all"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
                rows={3}
              />
            </Field>

            {error && (
              <div className="flex items-center gap-2 text-sm px-4 py-3 rounded-xl border"
                style={{ background: 'var(--danger-bg)', borderColor: '#FCA5A5', color: 'var(--danger)' }}>
                <IconAlert /> {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="submit"
                disabled={loading || !form.name.trim()}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors"
                style={{ background: 'var(--accent)' }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('projects.createModal.creating')}
                  </span>
                ) : t('projects.createModal.submit')}
              </button>
              <button type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-3 rounded-xl text-sm border transition-colors"
                style={{ color: 'var(--text-2)', borderColor: 'var(--border)', background: 'transparent' }}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Delete confirm ───────────────────────────────────────── */}
      {confirmId && (
        <Modal onClose={() => setConfirmId(null)}>
          <ModalHeader
            title={t('projects.deleteModal.title')}
            subtitle={t('projects.deleteModal.subtitle')}
            onClose={() => setConfirmId(null)}
            danger
          />
          <div className="p-6">
            <p className="text-sm mb-6" style={{ color: 'var(--text-2)' }}>
              {t('projects.deleteModal.body')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteConfirmed}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ background: 'var(--danger)' }}>
                {t('projects.deleteModal.confirm')}
              </button>
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm border transition-colors"
                style={{ color: 'var(--text-2)', borderColor: 'var(--border)' }}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── Project card (grid view) ───────────────────────────────────── */
function ProjectCard({ project, isFav, onClick, onDelete, onToggleFav, onArchive, isDeleting, isArchiving, t }) {
  const accent  = projectAccent(project.name);
  const statusKey = project.status || 'active';
  const STATUS_STYLE = {
    active:    { bg: '#F0FDF4', text: '#15803D', dot: '#16A34A' },
    archived:  { bg: '#FFFBEB', text: '#B45309', dot: '#D97706' },
    completed: { bg: '#EFF9FB', text: '#0E7490', dot: '#0E9F9F' },
  };
  const statusStyle = STATUS_STYLE[statusKey] ?? { bg: 'var(--surface-2)', text: 'var(--text-2)', dot: 'var(--text-3)' };
  const statusLabel = t(`projects.status.${statusKey}`, { defaultValue: statusKey });
  const initials = project.name.slice(0, 2).toUpperCase();
  const date = project.createdAt
    ? new Date(project.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    : null;
  const isAdmin = project.currentUserRole === 'admin' || project.currentUserRole === 'owner';
  const mc = project.memberCount ?? 0;
  const activity = relativeTime(project.updatedAt);

  return (
    <div
      onClick={onClick}
      className="group relative rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden hover:-translate-y-1"
      style={{
        background: 'var(--surface)',
        borderColor: isFav ? '#D97706' : 'var(--border)',
        boxShadow: isFav ? '0 2px 8px rgba(217,119,6,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = isFav ? '0 8px 24px rgba(217,119,6,0.2)' : '0 8px 24px rgba(0,0,0,0.1)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = isFav ? '0 2px 8px rgba(217,119,6,0.15)' : '0 1px 3px rgba(0,0,0,0.04)'}
    >
      {/* Left accent bar */}
      <div className="absolute top-0 left-0 bottom-0 w-1 transition-all duration-200 group-hover:w-1.5"
        style={{ background: accent }} />

      {/* Fav indicator strip at top */}
      {isFav && (
        <div className="absolute top-0 left-1 right-0 h-0.5" style={{ background: '#D97706' }} />
      )}

      {/* Card body */}
      <div className="pl-5 pr-4 pt-5 pb-4">

        {/* Top row */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white select-none shrink-0"
              style={{ background: accent }}>
              {initials}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ background: statusStyle.bg, color: statusStyle.text }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusStyle.dot }} />
              {statusLabel}
            </span>
            {/* Fav button */}
            <button
              onClick={onToggleFav}
              title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
              style={{ color: isFav ? '#D97706' : 'var(--text-3)', background: isFav ? '#FEF3C7' : 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#D97706'; e.currentTarget.style.background = '#FEF3C7'; }}
              onMouseLeave={e => { e.currentTarget.style.color = isFav ? '#D97706' : 'var(--text-3)'; e.currentTarget.style.background = isFav ? '#FEF3C7' : 'transparent'; }}
            >
              <IconStar filled={isFav} />
            </button>
            {/* Archive button — only if active */}
            {isAdmin && project.status === 'active' && (
              <button
                onClick={onArchive}
                disabled={isArchiving}
                title="Archiver le projet"
                className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                style={{ color: 'var(--text-3)', background: 'transparent' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#B45309'; e.currentTarget.style.background = '#FEF9C3'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; }}
              >
                {isArchiving
                  ? <span className="w-3.5 h-3.5 border-2 border-t-current rounded-full animate-spin" />
                  : <IconArchive />}
              </button>
            )}
            {/* Delete button */}
            {isAdmin && (
              <button
                onClick={onDelete}
                disabled={isDeleting}
                title={t('common.delete')}
                className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                style={{ color: 'var(--text-3)', background: 'transparent' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-bg)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; }}
              >
                {isDeleting
                  ? <span className="w-3.5 h-3.5 border-2 border-t-current rounded-full animate-spin" />
                  : <IconTrash />}
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <h2 className="font-semibold text-[15px] leading-snug mb-2 line-clamp-1 transition-colors group-hover:opacity-80"
          style={{ color: 'var(--text-1)' }}>
          {isFav && <span className="mr-1.5 text-[11px]" style={{ color: '#D97706' }}>★</span>}
          {project.name}
        </h2>

        {/* Description */}
        <p className="text-sm line-clamp-2 leading-relaxed" style={{ color: 'var(--text-3)', minHeight: '2.5rem' }}>
          {project.description || t('common.noDescription')}
        </p>

        {/* Progress bar */}
        {project.taskTotal > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium" style={{ color: 'var(--text-3)' }}>
                Progression
              </span>
              <span className="text-[10px] font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>
                {Math.round((project.taskDone / project.taskTotal) * 100)}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round((project.taskDone / project.taskTotal) * 100)}%`,
                  background: project.taskDone === project.taskTotal ? 'var(--success)' : 'var(--accent)',
                }} />
            </div>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>
              {project.taskDone}/{project.taskTotal} tâches terminées
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3.5 text-xs"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--text-3)' }}>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <IconUsers />
              {mc !== 1 ? t('projects.membersCount_plural', { count: mc }) : t('projects.membersCount', { count: mc })}
            </span>
            {project.sprintCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                {project.sprintCount} sprint{project.sprintCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {/* Activité récente */}
          {activity ? (
            <span className="flex items-center gap-1" title={`Créé le ${date}`}>
              <IconClock /> {activity}
            </span>
          ) : date ? (
            <span className="flex items-center gap-1">
              <IconCalendar /> {date}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── Project row (list view) ────────────────────────────────────── */
function ProjectRow({ project, isFav, onClick, onDelete, onToggleFav, onArchive, isDeleting, isArchiving, t }) {
  const accent    = projectAccent(project.name);
  const statusKey = project.status || 'active';
  const STATUS_STYLE = {
    active:    { bg: '#F0FDF4', text: '#15803D', dot: '#16A34A' },
    archived:  { bg: '#FFFBEB', text: '#B45309', dot: '#D97706' },
    completed: { bg: '#EFF9FB', text: '#0E7490', dot: '#0E9F9F' },
  };
  const statusStyle = STATUS_STYLE[statusKey] ?? { bg: 'var(--surface-2)', text: 'var(--text-2)', dot: 'var(--text-3)' };
  const statusLabel = t(`projects.status.${statusKey}`, { defaultValue: statusKey });
  const initials    = project.name.slice(0, 2).toUpperCase();
  const mc          = project.memberCount ?? 0;
  const isAdmin     = project.currentUserRole === 'admin' || project.currentUserRole === 'owner';
  const activity    = relativeTime(project.updatedAt);
  const pct         = project.taskTotal > 0 ? Math.round((project.taskDone / project.taskTotal) * 100) : null;

  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-4 px-5 py-4 rounded-2xl border cursor-pointer transition-all duration-150 hover:-translate-y-0.5"
      style={{
        background: 'var(--surface)',
        borderColor: isFav ? '#D97706' : 'var(--border)',
        boxShadow: isFav ? '0 2px 6px rgba(217,119,6,0.1)' : '0 1px 2px rgba(0,0,0,0.03)',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = isFav ? '0 2px 6px rgba(217,119,6,0.1)' : '0 1px 2px rgba(0,0,0,0.03)'}
    >
      {/* Accent dot */}
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0"
        style={{ background: accent }}>
        {initials}
      </div>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {isFav && <span style={{ color: '#D97706', fontSize: 11 }}>★</span>}
          <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--text-1)' }}>{project.name}</h3>
        </div>
        <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>
          {project.description || t('common.noDescription')}
        </p>
      </div>

      {/* Progress pill */}
      {pct !== null && (
        <div className="hidden sm:flex items-center gap-2 w-28 shrink-0">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
            <div className="h-full rounded-full" style={{
              width: `${pct}%`,
              background: pct === 100 ? 'var(--success)' : 'var(--accent)',
            }} />
          </div>
          <span className="text-[10px] tabular-nums shrink-0" style={{ color: 'var(--text-3)' }}>{pct}%</span>
        </div>
      )}

      {/* Status */}
      <span className="hidden md:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0"
        style={{ background: statusStyle.bg, color: statusStyle.text }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusStyle.dot }} />
        {statusLabel}
      </span>

      {/* Members + sprints */}
      <div className="hidden lg:flex items-center gap-3 text-xs shrink-0" style={{ color: 'var(--text-3)' }}>
        <span className="flex items-center gap-1"><IconUsers />{mc}</span>
        {project.sprintCount > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
            {project.sprintCount}S
          </span>
        )}
      </div>

      {/* Activity */}
      {activity && (
        <span className="hidden xl:flex items-center gap-1 text-xs w-24 shrink-0" style={{ color: 'var(--text-3)' }}>
          <IconClock />{activity}
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={onToggleFav} title={isFav ? 'Retirer favoris' : 'Favoris'}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: isFav ? '#D97706' : 'var(--text-3)', background: isFav ? '#FEF3C7' : 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#D97706'; e.currentTarget.style.background = '#FEF3C7'; }}
          onMouseLeave={e => { e.currentTarget.style.color = isFav ? '#D97706' : 'var(--text-3)'; e.currentTarget.style.background = isFav ? '#FEF3C7' : 'transparent'; }}>
          <IconStar filled={isFav} />
        </button>
        {isAdmin && project.status === 'active' && (
          <button onClick={onArchive} disabled={isArchiving} title="Archiver"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-3)', background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#B45309'; e.currentTarget.style.background = '#FEF9C3'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; }}>
            {isArchiving ? <span className="w-3.5 h-3.5 border-2 border-t-current rounded-full animate-spin" /> : <IconArchive />}
          </button>
        )}
        {isAdmin && (
          <button onClick={onDelete} disabled={isDeleting} title={t('common.delete')}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-3)', background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-bg)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; }}>
            {isDeleting ? <span className="w-3.5 h-3.5 border-2 border-t-current rounded-full animate-spin" /> : <IconTrash />}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Stat pill ──────────────────────────────────────────────────── */
function Stat({ n, label, color }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-2xl font-bold tabular-nums" style={{ color: color || 'var(--text-1)' }}>{n}</span>
      <span className="text-sm" style={{ color: 'var(--text-2)' }}>{label}</span>
    </div>
  );
}

/* ── Skeletons ──────────────────────────────────────────────────── */
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="pl-5 pr-4 pt-5 pb-4 space-y-3">
            <div className="skeleton w-10 h-10 rounded-xl" />
            <div className="skeleton h-4 rounded w-3/4" />
            <div className="skeleton h-3 rounded w-full" />
            <div className="skeleton h-3 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
function SkeletonList() {
  return (
    <div className="flex flex-col gap-2">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 rounded-2xl border"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="skeleton w-9 h-9 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 rounded w-1/3" />
            <div className="skeleton h-3 rounded w-2/3" />
          </div>
          <div className="skeleton h-3 rounded w-16 hidden sm:block" />
          <div className="skeleton h-6 rounded-full w-20 hidden md:block" />
        </div>
      ))}
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────────── */
function EmptyState({ search, onCreate, t }) {
  return (
    <div className="text-center py-24 px-6">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
        style={{ background: 'var(--surface-2)' }}>
        <IconFolder />
      </div>
      <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
        {search ? t('projects.noResults', { term: search }) : t('projects.noProjects')}
      </h3>
      <p className="text-sm mb-7" style={{ color: 'var(--text-3)' }}>
        {search ? t('projects.tryOther') : t('projects.createFirst')}
      </p>
      {!search && (
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
          style={{ background: 'var(--accent)' }}>
          <IconPlus size={3.5} /> {t('projects.createProject')}
        </button>
      )}
    </div>
  );
}

/* ── Pagination button ──────────────────────────────────────────── */
function PagBtn({ children, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="min-w-[2.25rem] h-9 px-3 rounded-xl text-sm font-medium border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      style={active
        ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
        : { background: 'var(--surface)', color: 'var(--text-2)', borderColor: 'var(--border)' }
      }>
      {children}
    </button>
  );
}

/* ── Modal shell ────────────────────────────────────────────────── */
function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden animate-modal-in"
        style={{ background: 'var(--surface)', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, subtitle, onClose, danger = false }) {
  return (
    <div className="flex items-center justify-between px-6 py-5"
      style={{ borderBottom: '1px solid var(--border)' }}>
      <div>
        <h2 className="text-base font-semibold" style={{ color: danger ? 'var(--danger)' : 'var(--text-1)' }}>{title}</h2>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{subtitle}</p>}
      </div>
      <button onClick={onClose}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
        style={{ color: 'var(--text-3)', background: 'var(--surface-2)' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-1)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
        <IconX />
      </button>
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: 'var(--text-2)' }}>
        {label}
        {required && <span style={{ color: 'var(--danger)' }}>*</span>}
        {hint && <span className="normal-case font-normal tracking-normal" style={{ color: 'var(--text-3)' }}>({hint})</span>}
      </label>
      {children}
    </div>
  );
}
