import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">

      {/* Background */}
      <div className="absolute inset-0"
        style={{
          backgroundImage: 'url(/alexsys-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
        }} />

      {/* Light overlay */}
      <div className="absolute inset-0"
        style={{ background: 'rgba(8,16,36,0.35)' }} />

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-6 animate-fade-up px-4">

        {/* AgentPM logo + name */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: '#0E7490', boxShadow: '0 0 24px rgba(14,116,144,0.55)' }}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <span className="text-white text-2xl font-bold tracking-tight"
            style={{ textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
            AgentPM
          </span>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm rounded-3xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.97)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.25)',
          }}>

          {/* Top teal bar */}
          <div className="h-1" style={{
            background: 'linear-gradient(90deg, #0E7490, #22D3EE, #0E7490)',
          }} />

          <div className="p-8">
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#1A1917' }}>
              {t('login.signIn')}
            </h2>
            <p className="text-sm mb-8 leading-relaxed" style={{ color: '#6B6560' }}>
              {t('login.signInSub')}
            </p>

            <button
              onClick={login}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-2xl text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
              style={{ background: '#1A1917', color: '#fff', boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#0E7490'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(14,116,144,0.40)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#1A1917'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.18)'; }}
            >
              <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
                <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
                <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              {t('login.btn')}
            </button>

            <p className="text-center text-xs mt-6" style={{ color: '#A09B94' }}>
              {t('login.secure')}
            </p>
          </div>
        </div>

        {/* Credit */}
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.40)' }}>
          by <span style={{ color: 'rgba(255,255,255,0.60)', fontWeight: 600 }}>Alexsys Solutions</span>
        </p>

      </div>
    </div>
  );
}
