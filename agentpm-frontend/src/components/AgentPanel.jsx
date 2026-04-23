import { useState, useRef, useEffect } from 'react';
import { agentChat, agentSearch } from '../api/agentApi';

const WELCOME = 'Bonjour ! Je suis AgentPM 🤖\nPosez-moi vos questions sur la gestion de projet, les sprints ou les tâches.';

export default function AgentPanel({ projectId }) {
  const [open, setOpen]           = useState(false);
  const [tab, setTab]             = useState('chat');
  const [messages, setMessages]   = useState([{ role: 'assistant', content: WELCOME }]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open && tab === 'chat')
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, tab]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setMessages(m => [...m, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    try {
      const { reply } = await agentChat(text, projectId ?? null);
      setMessages(m => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: "⚠️ Erreur de communication avec l'IA." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q || !projectId) return;
    setSearching(true);
    setSearchResults(null);
    try {
      const { tasks } = await agentSearch(q, projectId);
      setSearchResults(tasks ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <>
      {/* Floating trigger */}
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
        style={{ height: '520px' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-white text-base">🤖</span>
            <span className="text-white font-bold text-sm tracking-wide">AgentPM</span>
            <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-medium">AI</span>
          </div>
          <div className="flex gap-1 bg-indigo-700/50 rounded-full p-0.5">
            {[{ k: 'chat', label: '💬 Chat' }, { k: 'recherche', label: '🔍 Recherche' }].map(t => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={`text-xs px-3 py-1 rounded-full transition font-medium
                  ${tab === t.k ? 'bg-white text-indigo-700' : 'text-indigo-100 hover:text-white'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chat tab */}
        {tab === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50/50">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-sm mr-2 shrink-0 mt-0.5">🤖</div>
                  )}
                  <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed shadow-sm
                    ${m.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-sm shrink-0">🤖</div>
                  <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none px-4 py-2.5 shadow-sm">
                    <span className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={handleSend} className="border-t border-gray-100 p-3 flex gap-2 shrink-0 bg-white">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Poser une question..."
                disabled={loading}
                className="flex-1 text-sm border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="w-9 h-9 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 transition shrink-0"
              >
                ↑
              </button>
            </form>
          </>
        )}

        {/* Search tab */}
        {tab === 'recherche' && (
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <p className="text-xs text-gray-500 mb-3">Recherche sémantique parmi les tâches du projet.</p>
            <form onSubmit={handleSearch} className="flex gap-2 mb-4 shrink-0">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Ex: configurer l'authentification…"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                type="submit"
                disabled={searching || !searchQuery.trim() || !projectId}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-40 transition"
              >
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
                      {searchResults.map((title, i) => (
                        <div key={i} className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2.5 text-sm text-gray-800 flex items-start gap-2">
                          <span className="text-indigo-400 text-xs font-bold mt-0.5">#{i + 1}</span>
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
