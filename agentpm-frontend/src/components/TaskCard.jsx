import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useDraggable } from '@dnd-kit/core';
import { patchTaskPriority, updateTask } from '../api/taskApi';

/* ── Priority config (static — labels resolved via t() at render time) ── */
const PRIORITY_KEYS = ['low', 'medium', 'high', 'critical'];
const PRIORITY_STYLE = {
  low:      { border: '#CBD5E1', bg: '#F8FAFC', text: '#64748B' },
  medium:   { border: '#93C5FD', bg: '#EFF6FF', text: '#1D4ED8' },
  high:     { border: '#FCD34D', bg: '#FFFBEB', text: '#B45309' },
  critical: { border: '#FCA5A5', bg: '#FEF2F2', text: '#DC2626' },
};
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

/* ── Fixed-position portal dropdown (avoids overflow clipping) ── */
function PriorityDropdown({ pos, priorities, currentKey, onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handle), 50);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handle); };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      onPointerDown={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 99999,
        minWidth: '140px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '4px 0',
        boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
      }}
    >
      {priorities.map(p => (
        <button
          key={p.key}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onSelect(p.key); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            width: '100%', textAlign: 'left',
            padding: '8px 12px',
            fontSize: '12px', fontWeight: 500,
            color: p.key === currentKey ? 'var(--text-3)' : p.text,
            background: 'transparent',
            border: 'none', cursor: 'pointer',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = p.bg}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.border, flexShrink: 0 }} />
          {p.label}
          {p.key === currentKey && (
            <svg style={{ marginLeft: 'auto', width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      ))}
    </div>,
    document.body
  );
}

/* ── Tag inline popover (portal) ────────────────────────────────── */
function TagPopover({ pos, tags, onAddTag, onClose, t }) {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);
  const ref = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handle), 50);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handle); };
  }, [onClose]);

  const submit = () => {
    const tag = input.trim().replace(/,$/, '');
    if (tag) { onAddTag(tag); setInput(''); }
  };

  return createPortal(
    <div
      ref={ref}
      onPointerDown={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 99999,
        width: '220px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '10px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
      }}
    >
      {/* Existing tags */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
          {tags.map((tag, i) => {
            const c = TAG_COLORS[i % TAG_COLORS.length];
            return (
              <span key={i} style={{
                fontSize: '11px', fontWeight: 500,
                padding: '2px 8px', borderRadius: '999px',
                background: c.bg, color: c.text,
              }}>
                {tag}
              </span>
            );
          })}
        </div>
      )}

      {/* Input row */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); submit(); }
            if (e.key === 'Escape') onClose();
          }}
          placeholder={t('task.tagPopover.placeholder')}
          style={{
            flex: 1, fontSize: '12px',
            padding: '6px 10px',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            outline: 'none',
            background: 'var(--surface-2)',
            color: 'var(--text-1)',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); submit(); }}
          style={{
            padding: '6px 10px', fontSize: '12px', fontWeight: 600,
            background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          + OK
        </button>
      </div>
      <p style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '5px' }}>
        {t('task.tagPopover.hint')}
      </p>
    </div>,
    document.body
  );
}

/* ─────────────────────────────────────────────────────────────── */
export default function TaskCard({ task, onClick, onPriorityChanged, isAdmin = true }) {
  const { t } = useTranslation();
  const isDone = task.status === 'done';

  // Build priorities list with translated labels
  const priorities = PRIORITY_KEYS.map(key => ({
    key,
    label: t(`task.priorities.${key}`),
    ...PRIORITY_STYLE[key],
  }));
  const prioMap = Object.fromEntries(priorities.map(p => [p.key, p]));

  // Determine if the current user is assigned to this task
  const currentUserId = sessionStorage.getItem('userId');
  const isAssignedToMe = task.assigneeIds?.includes(currentUserId)
    || task.assigneeId === currentUserId;

  // Drag rules:
  //   Admin      → can drag anything (except done tasks stay non-draggable
  //                if they want; currently admins CAN drag done tasks)
  //   Collaborator → can only drag tasks assigned to them AND not done
  const dragDisabled = isAdmin
    ? false
    : !isAssignedToMe || isDone;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: dragDisabled,
  });

  const [currentPriority, setCurrentPriority] = useState(task.priority);
  const [localTags,        setLocalTags]        = useState(task.tags ?? []);
  const [showPrioMenu,     setShowPrioMenu]    = useState(false);
  const [prioMenuPos,      setPrioMenuPos]     = useState({ top: 0, left: 0 });
  const [showTagPop,       setShowTagPop]      = useState(false);
  const [tagPopPos,        setTagPopPos]       = useState({ top: 0, left: 0 });
  const [saving,           setSaving]          = useState(false);
  const [savingTag,        setSavingTag]       = useState(false);

  useEffect(() => { setCurrentPriority(task.priority); }, [task.priority]);
  useEffect(() => { setLocalTags(task.tags ?? []); }, [task.tags]);

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 100 }
    : undefined;

  const prio       = prioMap[currentPriority] ?? prioMap.medium;
  const leftBorder = PRIO_LEFT[currentPriority] ?? PRIO_LEFT.medium;
  const assigneeNames = (task.assigneeNames && task.assigneeNames.length > 0)
    ? task.assigneeNames
    : (task.assigneeName ? [task.assigneeName] : []);
  const photo = resolvePhoto(task);

  /* Priority change */
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

  /* Open priority menu */
  const openPrioMenu = (e) => {
    e.stopPropagation();
    if (showPrioMenu) { setShowPrioMenu(false); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setPrioMenuPos({ top: rect.bottom + 6, left: rect.left });
    setShowPrioMenu(true);
  };

  /* Open tag popover */
  const openTagPop = (e) => {
    e.stopPropagation();
    if (showTagPop) { setShowTagPop(false); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceAbove = rect.top;
    const popHeight = 130;
    const top = spaceAbove > popHeight ? rect.top - popHeight - 6 : rect.bottom + 6;
    setTagPopPos({ top, left: Math.min(rect.left, window.innerWidth - 240) });
    setShowTagPop(true);
  };

  /* Add tag and save immediately */
  const handleAddTag = async (newTag) => {
    if (localTags.includes(newTag)) return;
    const updated = [...localTags, newTag];
    setLocalTags(updated);
    setSavingTag(true);
    try {
      await updateTask(task.id, {
        title:       task.title,
        description: task.description ?? '',
        priority:    currentPriority,
        storyPoints: task.storyPoints ?? null,
        assigneeIds: task.assigneeIds?.length > 0 ? task.assigneeIds : (task.assigneeId ? [task.assigneeId] : []),
        assigneeId:  task.assigneeId ?? null,
        tags:        updated,
      });
      onPriorityChanged?.();
    } catch (e) {
      console.error(e);
      setLocalTags(localTags);
    } finally {
      setSavingTag(false);
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={{
          ...style,
          background: isDone ? '#FAFAF9' : 'var(--surface)',
          border: `1px solid var(--border)`,
          borderLeftWidth: '3px',
          borderLeftColor: isDone ? '#D1FAE5' : leftBorder,
          opacity: isDragging ? 0.45 : (isDone || (!isAdmin && !isAssignedToMe)) ? 0.72 : 1,
        }}
        {...attributes}
        {...listeners}
        onClick={() => { if (!isDragging) onClick?.(task); }}
        className={`group relative rounded-xl p-3 mb-2 transition-all duration-100 ${
          dragDisabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
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
              title={t('common.edit')}
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

        {/* Tags chips */}
        {localTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {localTags.map((tag, i) => {
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

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 mt-2">

          {/* Priority pill — fixed-position dropdown via portal */}
          {isAdmin ? (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={openPrioMenu}
              disabled={saving}
              className="text-xs px-2.5 py-0.5 rounded-full font-medium border transition-opacity hover:opacity-80 flex items-center gap-1 shrink-0"
              style={{ background: prio.bg, color: prio.text, borderColor: prio.border }}
            >
              {prio.label}
              <svg className="w-2.5 h-2.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : (
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium border shrink-0"
              style={{ background: prio.bg, color: prio.text, borderColor: prio.border }}>
              {prio.label}
            </span>
          )}

          {/* Right indicators */}
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-3)' }}>

            {/* Tag icon */}
            {isAdmin && (
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={openTagPop}
                disabled={savingTag}
                title={localTags.length > 0 ? `${localTags.length} tag(s)` : t('task.addTag')}
                className="relative flex items-center gap-0.5 p-1 rounded-lg transition-all"
                style={{
                  color: localTags.length > 0 ? '#7C3AED' : 'var(--text-3)',
                  background: localTags.length > 0 ? '#F3E8FF' : 'transparent',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#F3E8FF';
                  e.currentTarget.style.color = '#7C3AED';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = localTags.length > 0 ? '#F3E8FF' : 'transparent';
                  e.currentTarget.style.color = localTags.length > 0 ? '#7C3AED' : 'var(--text-3)';
                }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {localTags.length > 0 && (
                  <span className="text-[10px] font-semibold">{localTags.length}</span>
                )}
                {savingTag && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse"
                    style={{ background: 'var(--accent)' }} />
                )}
              </button>
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

            {/* Stacked avatars */}
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

      {/* Priority dropdown — portal */}
      {showPrioMenu && (
        <PriorityDropdown
          pos={prioMenuPos}
          priorities={priorities}
          currentKey={currentPriority}
          onSelect={handlePrioritySelect}
          onClose={() => setShowPrioMenu(false)}
        />
      )}

      {/* Tag popover — portal */}
      {showTagPop && (
        <TagPopover
          pos={tagPopPos}
          tags={localTags}
          onAddTag={handleAddTag}
          onClose={() => setShowTagPop(false)}
          t={t}
        />
      )}
    </>
  );
}
