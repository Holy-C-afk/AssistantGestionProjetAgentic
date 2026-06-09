import { useState, useRef, useEffect, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import {
  agentChat, startConversation,
  getProjectConversations, getConversation,
} from '../api/agentApi';

/* ── AI sparkle icon (no emoji) ────────────────────────────────── */
const IconAI = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
    strokeLinejoin="round" className={className}>
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
  </svg>
);

/* ── Small sparkle for the FAB ──────────────────────────────────── */
const IconSparkle = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.937 15.5A2 2 0 008.5 14.063l-6.135-1.582a.5.5 0 010-.962L8.5 9.936A2 2 0 009.937 8.5l1.582-6.135a.5.5 0 01.963 0L14.063 8.5A2 2 0 0015.5 9.937l6.135 1.581a.5.5 0 010 .964L15.5 14.063a2 2 0 00-1.437 1.437l-1.582 6.135a.5.5 0 01-.963 0z" />
  </svg>
);

const IconClose = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
const IconNew = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconHistory = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);
const IconBack = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M19 12H5m7-7l-7 7 7 7" />
  </svg>
);
const IconSend = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
  </svg>
);
const IconMsg = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

const HUB_URL = 'http://localhost:5157/hubs/agent';

const SUGGESTIONS = [
  { label: 'Résumé sprint',       text: "Donne-moi un résumé de l'avancement du sprint actuel." },
  { label: 'Membres du projet',   text: 'Qui sont les membres de ce projet ?' },
  { label: 'Décomposer une tâche',text: 'Comment décomposer une user story complexe en sous-tâches ?' },
  { label: 'Estimer les points',  text: "Comment estimer les story points d'une tâche correctement ?" },
  { label: 'Bonnes pratiques',    text: 'Quelles sont les bonnes pratiques Agile pour améliorer la vélocité ?' },
  { label: 'Gérer les blocages',  text: 'Comment gérer efficacement les tâches bloquées dans un sprint ?' },
];

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
    + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function sessionLabel(conv) {
  const first = (conv.messages ?? []).find(m => m.role === 'user');
  if (!first?.content) return `Session ${fmtDate(conv.createdAt)}`;
  const txt = first.content.trim();
  return txt.length > 52 ? txt.slice(0, 52) + '…' : txt;
}

function dtoToMessages(messages) {
  return (messages ?? [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content)
    .map(m => ({ role: m.role, content: m.content, id: m.id }));
}

const WELCOME_MSG = {
  role: 'assistant',
  content: 'Bonjour ! Je suis AgentPM.\nPosez-moi vos questions sur le projet, les sprints ou les tâches.',
  id: 'welcome',
  showSuggestions: true,
};

// ─────────────────────────────────────────────────────────────────
export default function AgentPanel({ projectId, sprintId }) {
  const [open, setOpen]           = useState(false);
  const [view, setView]           = useState('chat');

  const [messages, setMessages]   = useState([WELCOME_MSG]);
  const [input, setInput]         = useState('');
  const [streaming, setStreaming] = useState(false);
  const [convId, setConvId]       = useState(null);

  const [sessions, setSessions]         = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState(null);
  const [hubState, setHubState]   = useState('disconnected');

  const hubRef            = useRef(null);
  const bottomRef         = useRef(null);
  const streamBuf         = useRef('');
  const streamIdRef       = useRef(0);
  const resumedForProject = useRef(null); // tracks which projectId has already been auto-resumed
  const convCreatingRef   = useRef(null); // in-flight Promise<convId> — avoids duplicate POSTs

  // ── Auto-scroll ────────────────────────────────────────────────
  useEffect(() => {
    if (open && view === 'chat')
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, view]);

  // ── Pre-create a conversation in the background ───────────────
  // Called whenever convId is null and we want to be ready for the first send.
  const preCreateConversation = useCallback((pid) => {
    if (convCreatingRef.current) return; // already in flight
    convCreatingRef.current = startConversation(pid)
      .then(conv => { setConvId(conv.id); return conv.id; })
      .catch(() => null)
      .finally(() => { convCreatingRef.current = null; });
  }, []);

  // ── Auto-resume last session when panel opens ──────────────────
  // Fires whenever the panel opens OR the projectId changes.
  // Uses a ref so navigating to a different project triggers another load.
  useEffect(() => {
    if (!open || !projectId) return;
    if (resumedForProject.current === projectId) return; // already loaded for this project
    resumedForProject.current = projectId;              // mark immediately to avoid double-fire
    (async () => {
      try {
        const data = await getProjectConversations(projectId);
        if (!data || data.length === 0) {
          // No history — pre-create a conversation so convId is ready before the first send
          preCreateConversation(projectId);
          return;
        }
        const sorted = [...data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const last   = sorted[0];
        const fresh  = await getConversation(last.id);
        const msgs   = dtoToMessages(fresh.messages);
        if (msgs.length > 0) {
          setMessages(msgs);
          setConvId(last.id);
        }
      } catch { /* silent — start fresh */ }
    })();
  }, [open, projectId, preCreateConversation]);

  // ── SignalR ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (hubRef.current) return;

    setHubState('connecting');
    const userId = sessionStorage.getItem('userId') ?? '';

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        headers: { 'X-User-Id': userId },
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    conn.on('ReceiveToken', token => {
      streamBuf.current += token;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) return [...prev.slice(0, -1), { ...last, content: streamBuf.current }];
        return prev;
      });
    });

    conn.on('StreamDone', () => {
      streamBuf.current = '';
      setStreaming(false);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) return [...prev.slice(0, -1), { ...last, streaming: false, id: Date.now() }];
        return prev;
      });
    });

    conn.on('AgentThinking',   () => {});
    conn.on('AgentToolCall',   () => {});
    conn.on('AgentToolResult', () => {});
    conn.on('AgentError', msg => {
      setStreaming(false);
      streamBuf.current = '';
      setMessages(prev => [
        ...prev.filter(m => !m.streaming),
        { role: 'assistant', content: `⚠ ${msg}`, id: Date.now() },
      ]);
    });

    conn.onreconnecting(() => setHubState('connecting'));
    conn.onreconnected(()   => setHubState('connected'));
    conn.onclose(()         => { setHubState('disconnected'); hubRef.current = null; });

    conn.start()
      .then(()  => { hubRef.current = conn; setHubState('connected'); })
      .catch(() => { setHubState('error');  hubRef.current = null; });

    return () => { conn.stop(); hubRef.current = null; };
  }, [open]);

  // ── Load sessions list ─────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    if (!projectId) return;
    setSessionsLoading(true);
    try {
      const data = await getProjectConversations(projectId);
      setSessions([...data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch { setSessions([]); }
    finally { setSessionsLoading(false); }
  }, [projectId]);

  const openHistory = useCallback(async () => {
    setView('history');
    await loadSessions();
  }, [loadSessions]);

  // ── Select a session ───────────────────────────────────────────
  const selectSession = useCallback(async (conv) => {
    setLoadingSessionId(conv.id);
    try {
      const fresh = await getConversation(conv.id);
      const msgs  = dtoToMessages(fresh.messages);
      setMessages(msgs.length ? msgs : [WELCOME_MSG]);
      setConvId(conv.id);
      streamBuf.current = '';
    } catch {
      const msgs = dtoToMessages(conv.messages);
      setMessages(msgs.length ? msgs : [WELCOME_MSG]);
      setConvId(conv.id);
    } finally {
      setLoadingSessionId(null);
      setView('chat');
    }
  }, []);

  // ── New chat ───────────────────────────────────────────────────
  const newChat = useCallback(() => {
    setMessages([WELCOME_MSG]);
    setConvId(null);
    streamBuf.current = '';
    convCreatingRef.current = null;
    setView('chat');
    // Pre-create the next conversation immediately so convId is ready when user types
    if (projectId) preCreateConversation(projectId);
  }, [projectId, preCreateConversation]);

  // ── Ensure conversation in DB ──────────────────────────────────
  // Fast path: convId is usually already set (auto-resume or pre-create).
  // Slow path: wait for any in-flight creation, or create now as last resort.
  const ensureConversation = useCallback(async () => {
    if (convId) return convId;
    // If a pre-create is in flight, wait for it instead of firing another POST
    if (convCreatingRef.current) return await convCreatingRef.current;
    if (!projectId) return null;
    try {
      const conv = await startConversation(projectId);
      setConvId(conv.id);
      return conv.id;
    } catch { return null; }
  }, [convId, projectId]);

  // ── Send message ───────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || streaming) return;

    setMessages(prev => prev.map(m => ({ ...m, showSuggestions: false })));
    setMessages(prev => [...prev, { role: 'user', content: text, id: Date.now() }]);
    setStreaming(true);
    streamBuf.current = '';
    const sid = `stream-${++streamIdRef.current}`;
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true, id: sid }]);

    // Resolve convId without blocking the SignalR call — ensureConversation is usually instant
    // because the panel pre-creates the conversation on open.
    const cid = await ensureConversation();

    if (hubRef.current?.state === signalR.HubConnectionState.Connected) {
      hubRef.current
        .invoke('RunAgent', text, projectId ?? null, cid ?? null, sprintId ?? null)
        .catch(err => {
          setStreaming(false);
          streamBuf.current = '';
          setMessages(prev => [
            ...prev.filter(m => !m.streaming),
            { role: 'assistant', content: `⚠ ${err.message}`, id: Date.now() },
          ]);
        });
    } else {
      try {
        const { reply } = await agentChat(text, projectId);
        setMessages(prev => [
          ...prev.filter(m => !m.streaming),
          { role: 'assistant', content: reply, id: Date.now() },
        ]);
      } catch {
        setMessages(prev => [
          ...prev.filter(m => !m.streaming),
          { role: 'assistant', content: "⚠ Erreur de communication avec l'IA.", id: Date.now() },
        ]);
      } finally {
        setStreaming(false);
        streamBuf.current = '';
      }
    }
  }, [streaming, projectId, sprintId, ensureConversation]);

  const handleSend = e => { e.preventDefault(); sendMessage(input); setInput(''); };

  // Hub dot colour
  const hubDot = {
    connected:    { bg: 'var(--success)',  title: 'Connecté' },
    connecting:   { bg: 'var(--warning)',  title: 'Connexion…' },
    error:        { bg: 'var(--danger)',   title: 'Erreur' },
    disconnected: { bg: 'var(--text-3)',   title: 'Déconnecté' },
  }[hubState] ?? { bg: 'var(--text-3)', title: '' };

  // ──────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── FAB ────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Assistant IA"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl active:scale-95"
        style={{ background: open ? 'var(--accent-h)' : 'var(--accent)', color: '#fff' }}
      >
        {open
          ? <IconClose />
          : <IconSparkle size={22} />
        }
      </button>

      {/* ── Panel ──────────────────────────────────────────────── */}
      <div
        className={`fixed bottom-24 right-6 z-50 flex flex-col overflow-hidden rounded-2xl transition-all duration-200 ${
          open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
        style={{
          width: '384px', height: '580px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        }}
      >
        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>

          <div className="flex items-center gap-2.5">
            {/* Icon badge */}
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              <IconAI size={16} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>AgentPM</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>AI</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full inline-block"
                  style={{ background: hubDot.bg }}
                  title={hubDot.title} />
                <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{hubDot.title}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {view === 'history' ? (
              <>
                <HeaderBtn icon={<IconNew />} onClick={newChat}>Nouveau</HeaderBtn>
                <HeaderBtn icon={<IconBack />} onClick={() => setView('chat')}>Retour</HeaderBtn>
              </>
            ) : (
              <>
                {convId && <HeaderBtn icon={<IconNew />} onClick={newChat} title="Nouveau chat" />}
                <HeaderBtn icon={<IconHistory />} onClick={openHistory}>Historique</HeaderBtn>
              </>
            )}
          </div>
        </div>

        {/* ── History view ─────────────────────────────────────── */}
        {view === 'history' && (
          <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
            {sessionsLoading && (
              <div className="flex items-center justify-center h-32 gap-2 text-sm"
                style={{ color: 'var(--text-3)' }}>
                <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
                Chargement…
              </div>
            )}

            {!sessionsLoading && sessions.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 gap-3 px-6 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
                  <IconMsg />
                </div>
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                  Aucune conversation enregistrée.<br />
                  Posez une question pour démarrer.
                </p>
                <button onClick={newChat}
                  className="mt-1 text-sm px-4 py-2 rounded-xl font-semibold text-white transition-colors"
                  style={{ background: 'var(--accent)' }}>
                  Nouveau chat
                </button>
              </div>
            )}

            {!sessionsLoading && sessions.length > 0 && (
              <>
                <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-3)', borderBottom: '1px solid var(--border)' }}>
                  {sessions.length} conversation{sessions.length > 1 ? 's' : ''}
                </div>
                {sessions.map(conv => {
                  const isActive  = conv.id === convId;
                  const isLoading = loadingSessionId === conv.id;
                  const msgCount  = (conv.messages ?? []).filter(m => m.role === 'user').length;

                  return (
                    <button
                      key={conv.id}
                      onClick={() => selectSession(conv)}
                      disabled={isLoading}
                      className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors disabled:opacity-60"
                      style={{
                        background: isActive ? 'var(--accent-light)' : 'transparent',
                        borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                        borderBottom: '1px solid var(--border)',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface-2)'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* icon */}
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: isActive ? 'var(--accent)' : 'var(--surface-2)', color: isActive ? '#fff' : 'var(--text-3)' }}>
                        {isLoading
                          ? <span className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin"
                              style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
                          : <IconMsg />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug line-clamp-2"
                          style={{ color: isActive ? 'var(--accent-text)' : 'var(--text-1)' }}>
                          {sessionLabel(conv)}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                          {fmtDate(conv.createdAt)} · {msgCount} échange{msgCount > 1 ? 's' : ''}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ── Chat view ────────────────────────────────────────── */}
        {view === 'chat' && (
          <>
            {/* Session ribbon */}
            {convId && (
              <div className="px-4 py-1.5 flex items-center justify-between shrink-0"
                style={{ background: 'var(--accent-light)', borderBottom: '1px solid var(--border)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--accent-text)' }}>
                  Session en cours
                </span>
                <button onClick={openHistory}
                  className="text-xs transition-colors"
                  style={{ color: 'var(--accent)' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                  voir l'historique
                </button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
              style={{ background: 'var(--bg)' }}>
              {messages.map((m, i) => (
                <div key={m.id ?? i}>
                  <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                    {m.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mr-2 mt-0.5"
                        style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                        <IconAI size={14} />
                      </div>
                    )}

                    <div
                      className="max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed"
                      style={m.role === 'user' ? {
                        background: 'var(--accent)',
                        color: '#fff',
                        borderRadius: '16px 4px 16px 16px',
                      } : {
                        background: 'var(--surface)',
                        color: 'var(--text-1)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px 16px 16px 16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      {/* While waiting for first token → show bouncing dots inside the bubble */}
                      {m.streaming && !m.content ? (
                        <span className="flex gap-1.5 py-0.5">
                          {[0, 1, 2].map(j => (
                            <span key={j} className="inline-block w-1.5 h-1.5 rounded-full"
                              style={{
                                background: 'var(--accent)',
                                opacity: 0.7,
                                animation: `bounce 1.1s ease-in-out ${j * 0.18}s infinite`,
                              }} />
                          ))}
                        </span>
                      ) : (
                        <>
                          {m.content}
                          {m.streaming && (
                            <span className="inline-block w-0.5 h-4 ml-0.5 align-text-bottom rounded-full animate-pulse"
                              style={{ background: 'var(--accent)' }} />
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Suggestion chips */}
                  {m.showSuggestions && m.role === 'assistant' && !streaming && (
                    <div className="mt-3 ml-9 flex flex-wrap gap-1.5">
                      {SUGGESTIONS.map(s => (
                        <button key={s.label} onClick={() => sendMessage(s.text)}
                          className="text-xs px-2.5 py-1.5 rounded-xl border transition-all"
                          style={{
                            background: 'var(--surface)',
                            borderColor: 'var(--border)',
                            color: 'var(--text-2)',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--accent-light)';
                            e.currentTarget.style.borderColor = 'var(--accent)';
                            e.currentTarget.style.color = 'var(--accent)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'var(--surface)';
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.color = 'var(--text-2)';
                          }}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend}
              className="flex gap-2 p-3 shrink-0"
              style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
              <input
                type="text" value={input} onChange={e => setInput(e.target.value)}
                placeholder="Poser une question…" disabled={streaming}
                className="flex-1 text-sm rounded-xl px-4 py-2.5 outline-none transition-all"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-1)',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <button type="submit"
                disabled={streaming || !input.trim()}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#fff' }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--accent-h)'; }}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
              >
                <IconSend />
              </button>
            </form>
          </>
        )}
      </div>

      {/* Bounce keyframes for typing dots */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </>
  );
}

/* ── Small header button ────────────────────────────────────────── */
function HeaderBtn({ children, onClick, icon, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-all"
      style={{ color: 'var(--text-2)', borderColor: 'var(--border)', background: 'var(--surface-2)' }}
      onMouseEnter={e => {
        e.currentTarget.style.color = 'var(--accent)';
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.background = 'var(--accent-light)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = 'var(--text-2)';
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.background = 'var(--surface-2)';
      }}
    >
      {icon}
      {children && <span className="hidden sm:inline">{children}</span>}
    </button>
  );
}
