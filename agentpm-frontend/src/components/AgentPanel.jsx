import { useState, useRef, useEffect, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import {
  agentChat, startConversation,
  getProjectConversations, getConversation,
} from '../api/agentApi';

const WELCOME_MSG = {
  role: 'assistant',
  content: 'Bonjour ! Je suis AgentPM 🤖\nPosez-moi vos questions sur le projet, les sprints ou les tâches.',
  id: 'welcome',
  showSuggestions: true,
};
const HUB_URL = 'http://localhost:5157/hubs/agent';

const SUGGESTIONS = [
  { label: '📊 Résumé du sprint',        text: "Donne-moi un résumé de l'avancement du sprint actuel." },
  { label: '👥 Membres du projet',        text: 'Qui sont les membres de ce projet ?' },
  { label: '📝 Décomposer une tâche',    text: 'Comment décomposer une user story complexe en sous-tâches ?' },
  { label: '⚡ Estimer des story points', text: "Comment estimer les story points d'une tâche correctement ?" },
  { label: '🚀 Bonnes pratiques Agile',  text: 'Quelles sont les bonnes pratiques Agile pour améliorer la vélocité ?' },
  { label: '🐛 Gérer les blocages',      text: 'Comment gérer efficacement les tâches bloquées dans un sprint ?' },
];

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function sessionLabel(conv) {
  const first = (conv.messages ?? []).find(m => m.role === 'user');
  if (!first?.content) return `Session du ${fmtDate(conv.createdAt)}`;
  const t = first.content.trim();
  return t.length > 50 ? t.slice(0, 50) + '…' : t;
}

function dtoToMessages(messages) {
  return (messages ?? [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content)
    .map(m => ({ role: m.role, content: m.content, id: m.id }));
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AgentPanel({ projectId, sprintId }) {
  const [open, setOpen]           = useState(false);
  const [view, setView]           = useState('chat'); // 'chat' | 'history'

  // chat state
  const [messages, setMessages]   = useState([WELCOME_MSG]);
  const [input, setInput]         = useState('');
  const [streaming, setStreaming] = useState(false);
  const [convId, setConvId]       = useState(null);

  // history state
  const [sessions, setSessions]   = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState(null); // which session is being loaded

  // hub
  const [hubState, setHubState]   = useState('disconnected');

  const hubRef      = useRef(null);
  const bottomRef   = useRef(null);
  const streamBuf   = useRef('');
  const streamIdRef = useRef(0);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (open && view === 'chat')
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, view]);

  // ── SignalR ────────────────────────────────────────────────────────────────
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

    conn.on('AgentThinking',  () => {});
    conn.on('AgentToolCall',  () => {});
    conn.on('AgentToolResult',() => {});
    conn.on('AgentError', msg => {
      setStreaming(false);
      streamBuf.current = '';
      setMessages(prev => [
        ...prev.filter(m => !m.streaming),
        { role: 'assistant', content: `⚠️ ${msg}`, id: Date.now() },
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

  // ── Load sessions list ─────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    if (!projectId) return;
    setSessionsLoading(true);
    try {
      const data = await getProjectConversations(projectId);
      // newest first — show all, even if messages not yet saved
      setSessions([...data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, [projectId]);

  const openHistory = useCallback(async () => {
    setView('history');
    await loadSessions();
  }, [loadSessions]);

  // ── Select a session (fetch fresh messages from API) ───────────────────────
  const selectSession = useCallback(async (conv) => {
    setLoadingSessionId(conv.id);
    try {
      const fresh = await getConversation(conv.id); // always fetch fresh
      const msgs = dtoToMessages(fresh.messages);
      setMessages(msgs.length ? msgs : [WELCOME_MSG]);
      setConvId(conv.id);
      streamBuf.current = '';
    } catch {
      // fallback to list data
      const msgs = dtoToMessages(conv.messages);
      setMessages(msgs.length ? msgs : [WELCOME_MSG]);
      setConvId(conv.id);
    } finally {
      setLoadingSessionId(null);
      setView('chat');
    }
  }, []);

  // ── New chat ───────────────────────────────────────────────────────────────
  const newChat = useCallback(() => {
    setMessages([WELCOME_MSG]);
    setConvId(null);
    streamBuf.current = '';
    setView('chat');
  }, []);

  // ── Ensure conversation in DB ──────────────────────────────────────────────
  const ensureConversation = useCallback(async () => {
    if (convId) return convId;
    if (!projectId) return null;
    try {
      const conv = await startConversation(projectId);
      setConvId(conv.id);
      return conv.id;
    } catch { return null; }
  }, [convId, projectId]);

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || streaming) return;

    setMessages(prev => prev.map(m => ({ ...m, showSuggestions: false })));
    setMessages(prev => [...prev, { role: 'user', content: text, id: Date.now() }]);
    setStreaming(true);
    streamBuf.current = '';
    const sid = `stream-${++streamIdRef.current}`;
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true, id: sid }]);

    const cid = await ensureConversation();

    if (hubRef.current?.state === signalR.HubConnectionState.Connected) {
      hubRef.current
        .invoke('RunAgent', text, projectId ?? null, cid ?? null, sprintId ?? null)
        .catch(err => {
          setStreaming(false);
          streamBuf.current = '';
          setMessages(prev => [
            ...prev.filter(m => !m.streaming),
            { role: 'assistant', content: `⚠️ ${err.message}`, id: Date.now() },
          ]);
        });
    } else {
      // HTTP fallback
      try {
        const { reply } = await agentChat(text, projectId);
        setMessages(prev => [
          ...prev.filter(m => !m.streaming),
          { role: 'assistant', content: reply, id: Date.now() },
        ]);
      } catch {
        setMessages(prev => [
          ...prev.filter(m => !m.streaming),
          { role: 'assistant', content: "⚠️ Erreur de communication avec l'IA.", id: Date.now() },
        ]);
      } finally {
        setStreaming(false);
        streamBuf.current = '';
      }
    }
  }, [streaming, projectId, sprintId, ensureConversation]);

  const handleSend = e => { e.preventDefault(); sendMessage(input); setInput(''); };

  // ── Hub dot colour ─────────────────────────────────────────────────────────
  const dotClass = {
    connected:    'bg-green-400',
    connecting:   'bg-yellow-400 animate-pulse',
    error:        'bg-red-400',
    disconnected: 'bg-gray-400',
  }[hubState] ?? 'bg-gray-400';

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Assistant IA"
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-2xl transition-all duration-200
          ${open ? 'bg-indigo-700 rotate-90' : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105'} text-white`}
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Panel */}
      <div
        className={`fixed bottom-24 right-6 z-50 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden transition-all duration-300
          ${open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}
        style={{ height: '580px' }}
      >
        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-white text-base">🤖</span>
            <span className="text-white font-bold text-sm tracking-wide">AgentPM</span>
            <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-medium">AI</span>
            <span className={`inline-block w-2 h-2 rounded-full ${dotClass}`} />
          </div>

          <div className="flex items-center gap-1">
            {view === 'history' ? (
              // inside history: back + new chat
              <>
                <button onClick={newChat}
                  className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-full transition">
                  ✏️ Nouveau
                </button>
                <button onClick={() => setView('chat')}
                  className="text-xs bg-white text-indigo-700 px-3 py-1 rounded-full transition font-medium">
                  ← Retour
                </button>
              </>
            ) : (
              // inside chat: history button
              <>
                {convId && (
                  <button onClick={newChat} title="Nouveau chat"
                    className="text-xs text-indigo-100 hover:text-white hover:bg-white/20 px-2 py-1 rounded-full transition">
                    ✏️
                  </button>
                )}
                <button onClick={openHistory} title="Historique"
                  className="text-xs text-indigo-100 hover:text-white hover:bg-white/20 px-3 py-1 rounded-full transition">
                  🕐 Historique
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── History view ── */}
        {view === 'history' && (
          <div className="flex-1 overflow-y-auto bg-gray-50">
            {sessionsLoading && (
              <div className="flex items-center justify-center h-32 text-sm text-gray-400 gap-2">
                <span className="inline-block w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                Chargement…
              </div>
            )}

            {!sessionsLoading && sessions.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 gap-3 px-6 text-center">
                <span className="text-4xl">💬</span>
                <p className="text-sm text-gray-400">
                  Aucune conversation enregistrée.<br />
                  Posez une question pour démarrer.
                </p>
                <button onClick={newChat}
                  className="mt-1 text-sm bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition">
                  Nouveau chat
                </button>
              </div>
            )}

            {!sessionsLoading && sessions.length > 0 && (
              <>
                <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
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
                      className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-indigo-50 transition-colors flex items-start gap-3
                        ${isActive ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''}
                        ${isLoading ? 'opacity-60' : ''}`}
                    >
                      {/* icon */}
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5 text-sm">
                        {isLoading ? (
                          <span className="inline-block w-3.5 h-3.5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                        ) : (
                          isActive ? '▶' : '💬'
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 font-medium leading-snug line-clamp-2">
                          {sessionLabel(conv)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
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

        {/* ── Chat view ── */}
        {view === 'chat' && (
          <>
            {/* Active session indicator */}
            {convId && (
              <div className="px-4 py-1.5 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between shrink-0">
                <span className="text-xs text-indigo-500 font-medium">
                  Session en cours
                </span>
                <button onClick={openHistory}
                  className="text-xs text-indigo-400 hover:text-indigo-600 transition ml-2">
                  voir l'historique
                </button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50/50">
              {messages.map((m, i) => (
                <div key={m.id ?? i}>
                  <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-sm mr-2 shrink-0 mt-0.5">
                        🤖
                      </div>
                    )}
                    <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed shadow-sm
                      ${m.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>
                      {m.content}
                      {m.streaming && (
                        <span className="inline-block w-0.5 h-4 bg-indigo-400 animate-pulse ml-0.5 align-text-bottom" />
                      )}
                    </div>
                  </div>

                  {/* Suggestion chips on welcome only */}
                  {m.showSuggestions && m.role === 'assistant' && !streaming && (
                    <div className="mt-3 ml-9 flex flex-wrap gap-1.5">
                      {SUGGESTIONS.map(s => (
                        <button key={s.label} onClick={() => sendMessage(s.text)}
                          className="text-xs bg-white border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-full hover:bg-indigo-50 hover:border-indigo-400 transition shadow-sm">
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Bouncing dots while waiting */}
              {streaming && !messages.find(m => m.streaming && m.content) && (
                <div className="flex justify-start items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-sm shrink-0">🤖</div>
                  <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none px-4 py-2.5 shadow-sm">
                    <span className="flex gap-1">
                      {[0, 1, 2].map(j => (
                        <span key={j} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${j * 0.15}s` }} />
                      ))}
                    </span>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="border-t border-gray-100 p-3 flex gap-2 shrink-0 bg-white">
              <input
                type="text" value={input} onChange={e => setInput(e.target.value)}
                placeholder="Poser une question…" disabled={streaming}
                className="flex-1 text-sm border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50"
              />
              <button type="submit" disabled={streaming || !input.trim()}
                className="w-9 h-9 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 transition shrink-0">
                ↑
              </button>
            </form>
          </>
        )}
      </div>
    </>
  );
}
