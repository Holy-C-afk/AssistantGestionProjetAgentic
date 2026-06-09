import { useEffect, useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { patchTaskPriority } from '../api/taskApi';

/* ── Priority config ─────────────────────────────────── */
const PRIORITIES = [
  { key: 'low',      label: 'Faible',   cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  { key: 'medium',   label: 'Moyenne',  cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'high',     label: 'Haute',    cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  { key: 'critical', label: 'Critique', cls: 'bg-red-100 text-red-700 border-red-200' },
];
const PRIO_MAP = Object.fromEntries(PRIORITIES.map(p => [p.key, p]));

/* ── Tag color palette ───────────────────────────────── */
const TAG_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
  'bg-pink-100 text-pink-700',
  'bg-amber-100 text-amber-700',
  'bg-cyan-100 text-cyan-700',
  'bg-lime-100 text-lime-700',
];

/* ── Avatar helpers ──────────────────────────────────── */
const AVATAR_COLORS = [
  'bg-indigo-500','bg-violet-500','bg-pink-500',
  'bg-teal-500','bg-orange-500','bg-cyan-600',
  'bg-emerald-500','bg-rose-500',
];
function avatarColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name = '') {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?';
}

/* ── Resolve photo: DB photo > sessionStorage (current user) > null ── */
function resolvePhoto(task) {
  // 1. Photo stored in DB and returned by API
  if (task.assigneePhotoUrl) return task.assigneePhotoUrl;
  // 2. If the assignee is the current user, use their sessionStorage photo
  const currentUserId = sessionStorage.getItem('userId');
  if (task.assigneeId && task.assigneeId === currentUserId) {
    return sessionStorage.getItem('userPhoto') || null;
  }
  return null;
}

/* ─────────────────────────────────────────────────────── */

export default function TaskCard({ task, onClick, onPriorityChanged, isAdmin = true }) {
  const isDone = task.status === 'done';

  // Collaborateurs cannot drag tasks out of "done"; admins/chefs can always drag
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: isDone && !isAdmin,
  });

  const [currentPriority, setCurrentPriority] = useState(task.priority);
  const [showPrioMenu, setShowPrioMenu]         = useState(false);
  const [saving, setSaving]                     = useState(false);

  // Sync local priority state when the board re-fetches with updated task data
  useEffect(() => {
    setCurrentPriority(task.priority);
  }, [task.priority]);

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 100 }
    : undefined;

  const prio      = PRIO_MAP[currentPriority] ?? PRIO_MAP.medium;
  const tags      = task.tags ?? [];
  // Multi-assignee: prefer assigneeNames[] when available, fall back to primary
  const assigneeNames = (task.assigneeNames && task.assigneeNames.length > 0)
    ? task.assigneeNames
    : (task.assigneeName ? [task.assigneeName] : []);
  const name      = assigneeNames[0] ?? '';
  const photo     = resolvePhoto(task);

  /* Change priority inline */
  const handlePrioritySelect = async (key) => {
    setShowPrioMenu(false);
    if (key === currentPriority) return;
    setSaving(true);
    try {
      await patchTaskPriority(task.id, key);
      setCurrentPriority(key);
      onPriorityChanged?.();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => { if (!isDragging) onClick?.(task); }}
      className={`group relative bg-white rounded-lg border p-3 mb-2 shadow-sm transition-shadow ${
        isDone
          ? `border-green-200 bg-green-50/30 opacity-80 ${isAdmin ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : 'cursor-default'}`
          : 'border-gray-200 hover:shadow-md cursor-grab active:cursor-grabbing'
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* ── Title + icon ── */}
      <div className="flex items-start justify-between mb-2 gap-2">
        <h4 className="text-sm font-medium text-gray-900 leading-snug flex-1 pr-1">
          {task.title}
        </h4>
        <div className="flex items-center gap-1 shrink-0">
          {task.storyPoints != null && (
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
              {task.storyPoints}
            </span>
          )}
          {/* Open detail icon — always visible */}
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onClick?.(task); }}
            className="p-1 rounded hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition"
            title="Ouvrir la tâche"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Description ── */}
      {task.description && (
        <p className="text-xs text-gray-500 mb-2" style={{
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {task.description}
        </p>
      )}

      {/* ── Tags chips ── */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map((tag, i) => (
            <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[i % TAG_COLORS.length]}`}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex items-center justify-between gap-2 mt-2">

        {/* Priority — clickable dropdown for admins, read-only badge for collaborateurs */}
        <div className="relative">
          {isAdmin ? (
            <>
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); setShowPrioMenu(v => !v); }}
                disabled={saving}
                className={`text-xs px-2 py-0.5 rounded-full font-medium border transition hover:opacity-80 flex items-center gap-1 ${prio.cls}`}
                title="Changer la priorité"
              >
                {prio.label}
                <svg className="w-2.5 h-2.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showPrioMenu && (
                <div
                  onPointerDown={e => e.stopPropagation()}
                  className="absolute bottom-full mb-1 left-0 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[120px]"
                >
                  {PRIORITIES.map(p => (
                    <button
                      key={p.key}
                      onClick={e => { e.stopPropagation(); handlePrioritySelect(p.key); }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-gray-50 flex items-center gap-2 transition ${
                        p.key === currentPriority ? 'opacity-40 cursor-default' : ''
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${p.cls.split(' ')[0]}`} />
                      {p.label}
                      {p.key === currentPriority && <span className="ml-auto">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            // Collaborateur : read-only priority badge, no dropdown
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${prio.cls}`}>
              {prio.label}
            </span>
          )}
        </div>

        {/* Right indicators: tags icon + comments + assignee photo */}
        <div className="flex items-center gap-2 text-xs text-gray-400">

          {/* Tags icon with count */}
          {tags.length > 0 && (
            <span className="flex items-center gap-0.5 text-violet-400" title={`${tags.length} tag(s)`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span className="text-[10px] font-medium">{tags.length}</span>
            </span>
          )}

          {/* Comment count */}
          {task.commentCount > 0 && (
            <span className="flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {task.commentCount}
            </span>
          )}

          {/* Assignees — stacked avatars (up to 3 + overflow badge) */}
          {assigneeNames.length > 0 && (
            <div className="flex items-center -space-x-1.5">
              {assigneeNames.slice(0, 3).map((n, i) => {
                // First assignee may have a photo
                const imgSrc = i === 0 ? photo : null;
                return imgSrc ? (
                  <img
                    key={i}
                    src={imgSrc}
                    alt={n}
                    title={n}
                    className="w-6 h-6 rounded-full object-cover ring-2 ring-white shadow-sm shrink-0"
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <span
                    key={i}
                    title={n}
                    className={`w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 ring-2 ring-white shadow-sm ${avatarColor(n)}`}
                  >
                    {initials(n)}
                  </span>
                );
              })}
              {assigneeNames.length > 3 && (
                <span
                  title={assigneeNames.slice(3).join(', ')}
                  className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold flex items-center justify-center shrink-0 ring-2 ring-white shadow-sm"
                >
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
