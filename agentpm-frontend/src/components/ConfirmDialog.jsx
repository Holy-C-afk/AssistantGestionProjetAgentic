/* ── Generic confirm/alert dialog (replaces window.confirm) ──────── */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel  = 'Annuler',
  danger       = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden animate-modal-in"
        style={{ background: 'var(--surface)', boxShadow: '0 24px 64px rgba(0,0,0,0.24)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-3 mb-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: danger ? 'var(--danger-bg)' : 'var(--accent-light)',
                color:      danger ? 'var(--danger)'    : 'var(--accent)',
              }}>
              {danger ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86l-8.18 14.18A2 2 0 003.93 21h16.14a2 2 0 001.82-2.96L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="flex-1 pt-1">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{title}</h3>
            </div>
          </div>
          {message && (
            <p className="text-sm mt-2 whitespace-pre-line" style={{ color: 'var(--text-2)' }}>
              {message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ color: 'var(--text-2)', background: 'transparent', border: '1px solid var(--border)' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
            style={{ background: danger ? 'var(--danger)' : 'var(--accent)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
