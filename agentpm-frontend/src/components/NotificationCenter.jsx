import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import { getNotifications, markRead, markAllRead, deleteNotification } from '../api/notificationApi';

/* ── Icons ──────────────────────────────────────────────────────── */
const IconBell = ({ hasUnread }) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={hasUnread ? 2.5 : 2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);
const IconX = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IconCheck = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

/* ── Type config ────────────────────────────────────────────────── */
const TYPE_CFG = {
  task_assigned:    { icon: '📌', color: '#3B82F6', bg: '#EFF6FF' },
  sprint_closed:    { icon: '🏁', color: '#10B981', bg: '#F0FDF4' },
  member_added:     { icon: '👥', color: '#8B5CF6', bg: '#F5F3FF' },
  project_completed:{ icon: '🎉', color: '#F59E0B', bg: '#FFFBEB' },
  info:             { icon: 'ℹ️', color: 'var(--accent)', bg: 'var(--accent-light)' },
};

function relativeTime(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)  return 'À l\'instant';
  if (diff < 3600) return `${Math.floor(diff/60)} min`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  return `${Math.floor(diff/86400)}j`;
}

/* ── Main component ─────────────────────────────────────────────── */
export default function NotificationCenter() {
  const navigate      = useNavigate();
  const [open,        setOpen]        = useState(false);
  const [items,       setItems]       = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [hasNew,      setHasNew]      = useState(false);
  const panelRef      = useRef(null);
  const hubRef        = useRef(null);

  const userId = sessionStorage.getItem('userId');

  // Fetch on mount
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    getNotifications()
      .then(d => { setItems(d.items || []); setUnreadCount(d.unreadCount || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  // SignalR — connect once
  useEffect(() => {
    if (!userId) return;
    const hub = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5157/hubs/notifications', {
        headers: { 'X-User-Id': userId },
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    hub.on('ReceiveNotification', (notif) => {
      setItems(prev => [notif, ...prev].slice(0, 50));
      setUnreadCount(c => c + 1);
      setHasNew(true);
      setTimeout(() => setHasNew(false), 3000);
    });

    hub.start().catch(console.warn);
    hubRef.current = hub;
    return () => { hub.stop(); };
  }, [userId]);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setOpen(o => !o);
    setHasNew(false);
  };

  const handleMarkRead = async (id) => {
    await markRead(id).catch(console.warn);
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
  };

  const handleMarkAll = async () => {
    await markAllRead().catch(console.warn);
    setItems(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    await deleteNotification(id).catch(console.warn);
    const wasUnread = items.find(n => n.id === id)?.isRead === false;
    setItems(prev => prev.filter(n => n.id !== id));
    if (wasUnread) setUnreadCount(c => Math.max(0, c - 1));
  };

  const handleClick = (notif) => {
    if (!notif.isRead) handleMarkRead(notif.id);
    if (notif.projectId) navigate(`/projects/${notif.projectId}`);
    setOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>

      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl border transition-all"
        style={{
          background: open ? 'var(--accent-light)' : 'var(--surface-2)',
          borderColor: open ? 'var(--accent)' : 'var(--border)',
          color: open ? 'var(--accent)' : 'var(--text-2)',
        }}
        title="Notifications"
      >
        <IconBell hasUnread={unreadCount > 0} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: '#EF4444' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        {/* Pulse ring for new notification */}
        {hasNew && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full animate-ping opacity-60"
            style={{ background: '#EF4444' }} />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-12 w-80 rounded-2xl border shadow-2xl z-50 overflow-hidden"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                  style={{ background: '#EF4444' }}>{unreadCount}</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="flex items-center gap-1 text-xs font-medium transition-colors"
                style={{ color: 'var(--accent)' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <IconCheck /> Tout lire
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="skeleton w-9 h-9 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-3 rounded w-3/4" />
                      <div className="skeleton h-3 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>Aucune notification</p>
              </div>
            ) : (
              items.map(notif => {
                const cfg = TYPE_CFG[notif.type] || TYPE_CFG.info;
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className="group w-full flex gap-3 px-4 py-3 text-left transition-colors"
                    style={{
                      background: notif.isRead ? 'transparent' : 'var(--accent-light)',
                      borderBottom: '1px solid var(--border)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = notif.isRead ? 'transparent' : 'var(--accent-light)'}
                  >
                    {/* Icon */}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base"
                      style={{ background: cfg.bg }}>
                      {cfg.icon}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-1)' }}>
                        {notif.title}
                      </p>
                      <p className="text-xs mt-0.5 leading-relaxed line-clamp-2" style={{ color: 'var(--text-3)' }}>
                        {notif.message}
                      </p>
                      <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>
                        {relativeTime(notif.createdAt)}
                      </p>
                    </div>
                    {/* Unread dot + delete */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full mt-1" style={{ background: 'var(--accent)' }} />
                      )}
                      <button
                        onClick={e => handleDelete(e, notif.id)}
                        className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded transition-colors"
                        style={{ color: 'var(--text-3)' }}
                        onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = 'var(--danger)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; }}
                      >
                        <IconX />
                      </button>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="px-4 py-2.5 text-center" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                {items.length} notification{items.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
