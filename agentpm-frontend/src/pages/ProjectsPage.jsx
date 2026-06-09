import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getMyProjects, createProject, deleteProject } from '../api/projectApi';

const PAGE_SIZE = 9;

// Deterministic accent per project (warm palette, no pure purple-blue)
const ACCENTS = [
  '#0E7490','#0F766E','#B45309','#7C3AED','#BE185D',
  '#1D4ED8','#15803D','#9333EA','#C2410C','#0369A1',
];
const projectAccent = (name = '') => ACCENTS[name.charCodeAt(0) % ACCENTS.length];

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
  const [searchInput, setSearchInput] = useState('');
  const [refreshKey,  setRefreshKey]  = useState(0);
  const [showModal,    setShowModal]    = useState(false);
  const [form,         setForm]         = useState({ name: '', description: '' });
  const [loading,      setLoading]      = useState(false);
  const [fetching,     setFetching]     = useState(true);
  const [error,        setError]        = useState('');
  const [deletingId,   setDeletingId]   = useState(null);
  const [confirmId,    setConfirmId]    = useState(null);

  // Debounce: update `search` 300ms after the user stops typing
  const debounceRef = useRef(null);
  const handleSearchInput = (val) => {
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    if (val === '') {
      // Clear immediately — no delay
      setSearch('');
      setPage(1);
    } else {
      debounceRef.current = setTimeout(() => {
        setSearch(val);
        setPage(1);
      }, 300);
    }
  };

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
  }, [page, status, search, refreshKey, t]); // refreshKey forces re-fetch when incremented

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
      setRefreshKey(k => k + 1); // guaranteed re-fetch even if page was already 1
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
              {/* Inline clear ✕ button */}
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

        {/* Grid */}
        {fetching ? (
          <SkeletonGrid />
        ) : projects.length === 0 ? (
          <EmptyState search={search} onCreate={() => setShowModal(true)} t={t} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => navigate(`/projects/${project.id}`)}
                onDelete={e => { e.stopPropagation(); setConfirmId(project.id); }}
                isDeleting={deletingId === project.id}
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

/* ── Project card ───────────────────────────────────────────────── */
function ProjectCard({ project, onClick, onDelete, isDeleting, t }) {
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

  return (
    <div
      onClick={onClick}
      className="group relative rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden hover:-translate-y-1"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'}
    >
      {/* Left accent bar */}
      <div className="absolute top-0 left-0 bottom-0 w-1 transition-all duration-200 group-hover:w-1.5"
        style={{ background: accent }} />

      {/* Card body */}
      <div className="pl-5 pr-4 pt-5 pb-4">

        {/* Top row */}
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white select-none shrink-0"
            style={{ background: accent }}>
            {initials}
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ background: statusStyle.bg, color: statusStyle.text }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusStyle.dot }} />
              {statusLabel}
            </span>
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
          {project.name}
        </h2>

        {/* Description */}
        <p className="text-sm line-clamp-2 leading-relaxed" style={{ color: 'var(--text-3)', minHeight: '2.5rem' }}>
          {project.description || t('common.noDescription')}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3.5 text-xs"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--text-3)' }}>
          <span className="flex items-center gap-1.5">
            <IconUsers />
            {mc !== 1 ? t('projects.membersCount_plural', { count: mc }) : t('projects.membersCount', { count: mc })}
          </span>
          {date && (
            <span className="flex items-center gap-1">
              <IconCalendar /> {date}
            </span>
          )}
        </div>
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

/* ── Skeleton ───────────────────────────────────────────────────── */
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
