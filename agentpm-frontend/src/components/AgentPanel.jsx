import { useState, useRef, useEffect, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import { agentChat, agentSearch, startConversation } from '../api/agentApi';

const WELCOME = 'Bonjour ! Je suis AgentPM 🤖\nPosez-moi vos questions sur la gestion de projet, les sprints ou les tâches.';
const HUB_URL = 'http://localhost:5157/hubs/agent';

// ── Quick-reply suggestions ────────────────────────────────────────────────────
// Each item can be a plain string (sent as-is) or { label, text } for display vs sent text.
const SUGGESTIONS = [
  { label: '📊 Résumé du sprint',        text: 'Donne-moi un résumé de l\'avancement du sprint actuel.' },
  { label: '🔍 Tâches similaires',       text: 'Y a-t-il des tâches similaires à ce que je suis en train de faire ?' },
  { label: '📝 Décomposer une tâche',    text: 'Comment décomposer une user story complexe en sous-tâches ?' },
  { label: '⚡ Estimer des story points', text: 'Comment estimer les story points d\'une tâche correctement ?' },
  { label: '🚀 Bonnes pratiques Agile',  text: 'Quelles sont les bonnes pratiques Agile pour améliorer la vélocité ?' },
  { label: '🐛 Gérer les blocages',      text: 'Comment gérer efficacement les tâches bloquées dans un sprint ?' },
];

export default function AgentPanel({ projectId }) {
  const [open, setOpen]           = useState(false);
  const [tab, setTab]             = useState('chat');
  const [messages, setMessages]   = useState([{ role: 'assistant', content: WELCOME, id: 'welcome', showSuggestions: true }]);
  const [input, setInput]         = useState('');
  const [streaming, setStreaming] = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [convId, setConvId]       = useState(null);
  const [hubState, setHubState]   = useState('disconnected');
  const [activeToolCall, setActiveToolCall] = useState(null);

  const hubRef    = useRef(null);
  const bottomRef = useRef(null);
  const streamBuf = useRef('');

  // ── Auto-scroll ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (open && tab === 'chat')
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, tab]);

  // ── SignalR connection ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (hubRef.current) return;

    setHubState('connecting');
    const userId = sessionStorage.getItem('userId') ?? '';

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        headers: { 'X-User-Id': userId },
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('ReceiveToken', (token) => {
      streamBuf.current += token;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) return [...prev.slice(0, -1), { ...last, content: streamBuf.current }];
        return prev;
      });
    });

    connection.on('StreamDone', () => {
      streamBuf.current = '';
      setStreaming(false);
      setActiveToolCall(null);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) return [...prev.slice(0, -1), { ...last, streaming: false }];
        return prev;
      });
    });

    connection.on('AgentThinking', () => setActiveToolCall({ phase: 'thinking' }));
    connection.on('AgentToolCall',  ({ tool, input: inp }) => setActiveToolCall({ tool, input: inp, phase: 'calling' }));
    connection.on('AgentToolResult',({ tool }) => {
      setActiveToolCall({ tool, phase: 'result' });
      setTimeout(() => setActiveToolCall(null), 1200);
    });
    connection.on('AgentError', (msg) => {
      setStreaming(false);
      setActiveToolCall(null);
      streamBuf.current = '';
      setMessages(prev => [
        ...prev.filter(m => !m.streaming),
        { role: 'assistant', content: `⚠️ ${msg}`, id: Date.now() },
      ]);
    });

    connection.onreconnecting(() => setHubState('connecting'));
    connection.onreconnected(()   => setHubState('connected'));
    connection.onclose(()         => { setHubState('disconnected'); hubRef.current = null; });

    connection.start()
      .then(()  => { hubRef.current = connection; setHubState('connected'); })
      .catch(()  => { setHubState('error'); hubRef.current = null; });

    return () => { connection.stop(); hubRef.current = null; };
  }, [open]);

  // ── Conversation persistence ─────────────────────────────────────────────────
  const ensureConversation = useCallback(async () => {
    if (convId) return convId;
    if (!projectId) return null;
    try {
      const conv = await startConversation(projectId);
      setConvId(conv.id);
      return conv.id;
    } catch { return null; }
  }, [convId, projectId]);

  // ── Core send logic (shared by text input + suggestion chips) ────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || streaming) return;

    // Hide suggestions on all previous messages once conversation starts
    setMessages(prev => prev.map(m => ({ ...m, showSuggestions: false })));

    setMessages(prev => [...prev, { role: 'user', content: text, id: Date.now() }]);
    setStreaming(true);
    streamBuf.current = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true, id: 'stream' }]);

    const cid = await ensureConversation();

    if (hubRef.current?.state === signalR.HubConnectionState.Connected) {
      hubRef.current.invoke('RunAgent', text, projectId ?? null, cid ?? null)
        .catch(err => {
          setStreaming(false);
          setActiveToolCall(null);
          streamBuf.current = '';
          setMessages(prev => [
            ...prev.filter(m => !m.streaming),
            { role: 'assistant', content: `⚠️ Erreur hub: ${err.message}`, id: Date.now() },
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
  }, [streaming, projectId, ensureConversation]);

  const handleSend = (e) => { e.preventDefault(); sendMessage(input); setInput(''); };
  const handleSuggestion = (text) => sendMessage(text);

  // ── Semantic search ──────────────────────────────────────────────────────────
  const handleSearch = async (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q || !projectId) return;
    setSearching(true);
    setSearchResults(null);
    try {
      const { tasks } = await agentSearch(q, projectId);
      setSearchResults(tasks ?? []);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  // ── Hub dot ──────────────────────────────────────────────────────────────────
  const dotClass = {
    connected: 'bg-green-400', connecting: 'bg-yellow-400 animate-pulse',
    error: 'bg-red-400',       disconnected: 'bg-gray-400',
  }[hubState];
  const dotTitle = {
    connected: 'Streaming actif', connecting: 'Connexion…',
    error: 'Erreur hub',          disconnected: 'Hors ligne',
  }[hubState];

  return (
    <>
      {/* Floating trigger */}
      <button onClick={() => setOpen(o => !o)} title="Assistant IA"
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-2xl transition-all duration-200
          ${open ? 'bg-indigo-700 rotate-90' : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105'} text-white`}>
        {open ? '✕' : '🤖'}
      </button>

      {/* Panel */}
      <div
        className={`fixed bottom-24 right-6 z-50 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden transition-all duration-300
          ${open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}
        style={{ height: '560px' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-white text-base">🤖</span>
            <span className="text-white font-bold text-sm tracking-wide">AgentPM</span>
            <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-medium">AI</span>
            <span title={dotTitle} className={`inline-block w-2 h-2 rounded-full ${dotClass}`} />
          </div>
          <div className="flex gap-1 bg-indigo-700/50 rounded-full p-0.5">
            {[{ k: 'chat', label: '💬 Chat' }, { k: 'recherche', label: '🔍 Recherche' }].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={`text-xs px-3 py-1 rounded-full transition font-medium
                  ${tab === t.k ? 'bg-white text-indigo-700' : 'text-indigo-100 hover:text-white'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Chat tab ────────────────────────────────────────────────────────── */}
        {tab === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50/50">
              {messages.map((m, i) => (
                <div key={m.id ?? i}>
                  <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-sm mr-2 shrink-0 mt-0.5">🤖</div>
                    )}
                    <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed shadow-sm
                      ${m.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}
                    >
                      {m.content}
                      {m.streaming && (
                        <span className="inline-block w-0.5 h-4 bg-indigo-400 animate-pulse ml-0.5 align-text-bottom" />
                      )}
                    </div>
                  </div>

                  {/* Quick-reply chips — shown only on the welcome/last assistant message */}
                  {m.showSuggestions && m.role === 'assistant' && !streaming && (
                    <div className="mt-3 ml-9 flex flex-wrap gap-1.5">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s.label}
                          onClick={() => handleSuggestion(s.text)}
                          className="text-xs bg-white border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-full hover:bg-indigo-50 hover:border-indigo-400 transition shadow-sm"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Tool-call indicator */}
              {activeToolCall && (
                <div className="flex justify-start items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-sm shrink-0">⚙️</div>
                  <div className="bg-purple-50 border border-purple-100 rounded-2xl rounded-tl-none px-3 py-2 text-xs text-purple-700 max-w-[78%]">
                    {activeToolCall.phase === 'thinking' && <span className="italic">Réflexion en cours…</span>}
                    {activeToolCall.phase === 'calling'  && <span>Appel outil <strong>{activeToolCall.tool}</strong>…</span>}
                    {activeToolCall.phase === 'result'   && <span>✓ <strong>{activeToolCall.tool}</strong> terminé</span>}
                  </div>
                </div>
              )}

              {/* Bouncing dots while waiting for first token */}
              {streaming && !messages.find(m => m.streaming && m.content) && !activeToolCall && (
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

            {/* Input row */}
            <form onSubmit={handleSend} className="border-t border-gray-100 p-3 flex gap-2 shrink-0 bg-white">
              <input type="text" value={input} onChange={e => setInput(e.target.value)}
                placeholder="Poser une question…" disabled={streaming}
                className="flex-1 text-sm border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50" />
              <button type="submit" disabled={streaming || !input.trim()}
                className="w-9 h-9 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 transition shrink-0">
                ↑
              </button>
            </form>
          </>
        )}

        {/* ── Search tab ──────────────────────────────────────────────────────── */}
        {tab === 'recherche' && (
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <p className="text-xs text-gray-500 mb-3">Recherche sémantique parmi les tâches du projet.</p>
            <form onSubmit={handleSearch} className="flex gap-2 mb-4 shrink-0">
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Ex: configurer l'authentification…"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              <button type="submit" disabled={searching || !searchQuery.trim() || !projectId}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-40 transition">
                {searching
                  ? <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : 'Chercher'}
              </button>
            </form>

            {!projectId && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-gray-400 text-center">🔒 Ouvrez un projet pour activer<br />la recherche sémantique.</p>
              </div>
            )}
            {projectId && searchResults === null && !searching && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-gray-400 text-center">Entrez une description de tâche<br />pour trouver des tâches similaires.</p>
              </div>
            )}
            {searchResults !== null && (
              <div className="flex-1 overflow-y-auto space-y-2">
                {searchResults.length === 0
                  ? <p className="text-sm text-gray-400 text-center pt-8">Aucune tâche similaire trouvée.</p>
                  : <>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        {searchResults.length} tâche(s) similaire(s)
                      </p>
                      {searchResults.map((title, idx) => (
                        <div key={idx} className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2.5 text-sm text-gray-800 flex items-start gap-2">
                          <span className="text-indigo-400 text-xs font-bold mt-0.5">#{idx + 1}</span>
                          <span>{title}</span>
                        </div>
                      ))}
                    </>
                }
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
