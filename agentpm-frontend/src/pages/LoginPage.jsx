import { useAuth } from '../auth/useAuth';

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>

      {/* ── Left panel — editorial branding ── */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-14"
        style={{ background: '#0C1824' }}>

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--accent)' }}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <span className="text-white text-lg font-bold tracking-tight">AgentPM</span>
        </div>

        {/* Main copy */}
        <div>
          <h1 className="text-5xl font-bold text-white leading-tight tracking-tight mb-5">
            Pilotez vos projets<br />
            <span style={{ color: 'var(--accent)' }}>avec l'IA.</span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: '#94A3B8' }}>
            AgentPM combine la gestion de projet Agile avec un assistant intelligent — pour décomposer, estimer et livrer plus vite.
          </p>
        </div>

        {/* Feature list */}
        <div className="space-y-4">
          {[
            'Kanban board multi-sprint',
            'IA : décomposition et estimation automatique',
            'Notifications et rapports PDF',
          ].map(f => (
            <div key={f} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--accent)' }}>
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm" style={{ color: '#94A3B8' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — sign in ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--accent)' }}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>AgentPM</span>
        </div>

        <div className="w-full max-w-sm animate-fade-up">
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-1)' }}>Connexion</h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text-2)' }}>
            Utilisez votre compte Microsoft pour accéder à votre espace.
          </p>

          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-3 py-3 px-6 rounded-xl text-sm font-semibold transition-all duration-150 hover:-translate-y-0.5 active:scale-[0.98]"
            style={{
              background: 'var(--text-1)',
              color: '#FFFFFF',
            }}
          >
            {/* Microsoft logo */}
            <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
              <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
              <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            Se connecter avec Microsoft
          </button>

          <p className="text-xs text-center mt-6" style={{ color: 'var(--text-3)' }}>
            Authentification sécurisée via Azure AD
          </p>
        </div>
      </div>
    </div>
  );
}
