import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);
let _idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback(({ title, description, type = 'success', duration = 4000 }) => {
    const id = ++_idCounter;
    setToasts(prev => [...prev, { id, title, description, type }]);
    timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

/* ── Toast types ──────────────────────────────────────────────── */
const TYPE_CFG = {
  success: {
    accent: '#15803D',
    bg:     '#F0FDF4',
    border: '#86EFAC',
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  error: {
    accent: '#DC2626',
    bg:     '#FEF2F2',
    border: '#FCA5A5',
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
  info: {
    accent: '#0E7490',
    bg:     '#EFF9FB',
    border: '#67E8F9',
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01" />
        <circle cx="12" cy="12" r="10" strokeWidth={2} />
      </svg>
    ),
  },
};

/* ── Toast container ──────────────────────────────────────────── */
function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 max-w-[340px] w-full pointer-events-none">
      {toasts.map(t => {
        const cfg = TYPE_CFG[t.type] ?? TYPE_CFG.info;
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl border animate-slide-in"
            style={{
              background: cfg.bg,
              borderColor: cfg.border,
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}
          >
            {/* Icon */}
            <div className="mt-0.5 shrink-0" style={{ color: cfg.accent }}>
              {cfg.icon}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: cfg.accent }}>
                {t.title}
              </p>
              {t.description && (
                <p className="text-xs mt-0.5 truncate" style={{ color: cfg.accent, opacity: 0.75 }}>
                  {t.description}
                </p>
              )}
            </div>

            {/* Dismiss */}
            <button
              onClick={() => onDismiss(t.id)}
              className="shrink-0 mt-0.5 transition-opacity hover:opacity-60"
              style={{ color: cfg.accent }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
