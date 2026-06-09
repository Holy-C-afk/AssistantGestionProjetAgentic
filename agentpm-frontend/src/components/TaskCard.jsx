import { useEffect, useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { patchTaskPriority } from '../api/taskApi';

/* ── Priority config ──────────────────────────────────────────── */
const PRIORITIES = [
  { key: 'low',      label: 'Faible',   border: '#CBD5E1', bg: '#F8FAFC', text: '#64748B' },
  { key: 'medium',   label: 'Moyenne',  border: '#93C5FD', bg: '#EFF6FF', text: '#1D4ED8' },
  { key: 'high',     label: 'Haute',    border: '#FCD34D', bg: '#FFFBEB', text: '#B45309' },
  { key: 'critical', label: 'Critique', border: '#FCA5A5', bg: '#FEF2F2', text: '#DC2626' },
];
const PRIO_MAP = Object.fromEntries(PRIORITIES.map(p => [p.key, p]));

// Left border accent by priority
const PRIO_LEFT = {
  low:      '#CBD5E1',
  medium:   '#3B82F6',
  high:     '#F59E0B',
  critical: '#EF4444',
};

/* ── Tag color palette ────────────────────────────────────────── */
const TAG_COLORS = [
  { bg: '#F3E8FF', text: '#7C3AED' },
  { bg: '#CCFBF1', text: '#0F766E' },
  { bg: '#FCE7F3', text: '#BE185D' },
  { bg: '#FEF9C3', text: '#A16207' },
  { bg: '#CFFAFE', text: '#155E75' },
  { bg: '#DCFCE7', text: '#15803D' },
];

/* ── Avatar helpers ───────────────────────────────────────────── */
const AVATAR_BG = [
  '#0E7490','#0F766E','#6D28D9','#BE185D',
  '#1D4ED8','#15803D','#B45309','#9333EA',
];
function avatarColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_BG[h % AVATAR_BG.length];
}
function initials(name = '') {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function resolvePhoto(task) {
  if (task.assigneePhotoUrl) return task.assigneePhotoUrl;
  const currentUserId = sessionStorage.getItem('userId');
  if (task.assigneeId && task.assigneeId === currentUserId) {
    return sessionStorage.getItem('userPhoto') || null;
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────── */
export default function TaskCard({ task, onClick, onPriorityChanged, isAdmin = true }) {
  const isDone = task.status === 'done';

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: isDone && !isAdmin,
  });

  const [currentPriority, setCurrentPriority] = useState(task.priority);
  const [showPrioMenu,     setShowPrioMenu]    = useState(false);
  const [saving,           setSaving]          = useState(false);
  const menuRef = useRef(null);

  useEffect(() => { setCurrentPriority(task.priority); }, [task.priority]);

  // Close priority menu when clicking outside
  useEffect(() => {
    if (!showPrioMenu) return;
    const handle = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowPrioMenu(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showPrioMenu]);

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 100 }
    : undefined;

  const prio        = PRIO_MAP[currentPriority] ?? PRIO_MAP.medium;
  const leftBorder  = PRIO_LEFT[currentPriority] ?? PRIO_LEFT.medium;
  const tags        = task.tags ?? [];
  const assigneeNames = (task.assigneeNames && task.assigneeNames.length > 0)
    ? task.assigneeNames
    : (task.assigneeName ? [task.assigneeName] : []);
  const photo = resolvePhoto(task);

  const handlePrioritySelect = async (key) => {
    setShowPrioMenu(false);
    if (key === currentPriority) return;
    setSaving(true);
    try {
      await patchTaskPriority(task.id, key);
      setCurrentPriority(key);
      onPriorityChanged?.();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: isDone ? '#FAFAF9' : 'var(--surface)',
        borderLeft: `3px solid ${isDone ? '#D1FAE5' : leftBorder}`,
        border: `1px solid var(--border)`,
        borderLeftWidth: '3px',
        borderLeftColor: isDone ? '#D1FAE5' : leftBorder,
        opacity: isDragging ? 0.45 : isDone ? 0.8 : 1,
      }}
      {...attributes}
      {...listeners}
      onClick={() => { if (!isDragging) onClick?.(task); }}
      className={`group relative rounded-xl p-3 mb-2 transition-all duration-100 ${
        isDone && !isAdmin ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
      }`}
      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Title row */}
      <div className="flex items-start justify-between mb-2 gap-2">
        <h4 className="text-sm font-medium leading-snug flex-1 pr-1"
          style={{ color: isDone ? 'var(--text-2)' : 'var(--text-1)' }}>
          {task.title}
        </h4>
        <div className="flex items-center gap-1 shrink-0">
          {task.storyPoints != null && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold tabular-nums"
              style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              {task.storyPoints}
            </span>
          )}
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onClick?.(task); }}
            className="p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            style={{ color: 'var(--text-3)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-light)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; }}
            title="Ouvrir"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs mb-2 leading-relaxed"
          style={{
            color: 'var(--text-3)',
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
          {task.description}
        </p>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map((tag, i) => {
            const c = TAG_COLORS[i % TAG_COLORS.length];
            return (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: c.bg, color: c.text }}>
                {tag}
              </span>
            );
          })}
        </div>
      )}

      {/* Footer: priority + meta indicators */}
      <div className="flex items-center justify-between gap-2 mt-2">

        {/* Priority */}
        <div className="relative" ref={menuRef}>
          {isAdmin ? (
            <>
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); setShowPrioMenu(v => !v); }}
                disabled={saving}
                className="text-xs px-2.5 py-0.5 rounded-full font-medium border transition-opacity hover:opacity-80 flex items-center gap-1"
                style={{ background: prio.bg, color: prio.text, borderColor: prio.border }}
              >
                {prio.label}
                <svg className="w-2.5 h-2.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showPrioMenu && (
                <div
                  onPointerDown={e => e.stopPropagation()}
                  className="absolute bottom-full mb-1.5 left-0 rounded-xl border py-1 z-50 min-w-[130px]"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  }}
                >
                  {PRIORITIES.map(p => (
                    <button
                      key={p.key}
                      onClick={e => { e.stopPropagation(); handlePrioritySelect(p.key); }}
                      className="w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2.5 transition-colors"
                      style={{
                        color: p.key === currentPriority ? 'var(--text-3)' : p.text,
                        background: 'transparent',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = p.bg}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: p.border }} />
                      {p.label}
                      {p.key === currentPriority && (
                        <svg className="ml-auto w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium border"
              style={{ background: prio.bg, color: prio.text, borderColor: prio.border }}>
              {prio.label}
            </span>
          )}
        </div>

        {/* Right indicators */}
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-3)' }}>

          {/* Comments count */}
          {task.commentCount > 0 && (
            <span className="flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {task.commentCount}
            </span>
          )}

          {/* Assignees — stacked avatars */}
          {assigneeNames.length > 0 && (
            <div className="flex items-center -space-x-1.5">
              {assigneeNames.slice(0, 3).map((n, i) => {
                const imgSrc = i === 0 ? photo : null;
                return imgSrc ? (
                  <img key={i} src={imgSrc} alt={n} title={n}
                    className="w-6 h-6 rounded-full object-cover ring-2 ring-white shrink-0"
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <span key={i} title={n}
                    className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 ring-2 ring-white"
                    style={{ background: avatarColor(n) }}>
                    {initials(n)}
                  </span>
                );
              })}
              {assigneeNames.length > 3 && (
                <span title={assigneeNames.slice(3).join(', ')}
                  className="w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ring-2 ring-white"
                  style={{ background: 'var(--border)', color: 'var(--text-2)' }}>
                  +{assigneeNames.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
