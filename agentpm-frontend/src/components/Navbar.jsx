import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { useTranslation } from 'react-i18next';
import { graphRequest } from '../auth/authConfig';
import { fetchAndStorePhoto } from '../utils/graphPhoto';
import { useAuth } from '../auth/useAuth';

export default function Navbar() {
  const { pathname }           = useLocation();
  const { instance, accounts } = useMsal();
  const account                = accounts[0];
  const { logout }             = useAuth();
  const { t, i18n }            = useTranslation();

  const userName  = sessionStorage.getItem('userName')  || '';
  const userEmail = sessionStorage.getItem('userEmail') || '';

  const [userPhoto,    setUserPhoto]    = useState(() => sessionStorage.getItem('userPhoto'));
  const [needsConsent, setNeedsConsent] = useState(
    () => sessionStorage.getItem('photoConsentNeeded') === 'true' && !sessionStorage.getItem('userPhoto')
  );
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const onReady   = () => setUserPhoto(sessionStorage.getItem('userPhoto'));
    const onConsent = () => { if (!sessionStorage.getItem('userPhoto')) setNeedsConsent(true); };
    window.addEventListener('userPhotoReady',     onReady);
    window.addEventListener('photoConsentNeeded', onConsent);
    return () => {
      window.removeEventListener('userPhotoReady',     onReady);
      window.removeEventListener('photoConsentNeeded', onConsent);
    };
  }, []);

  const handleConnectPhoto = async () => {
    if (!account) return;
    setConnecting(true);
    try {
      const response = await instance.acquireTokenPopup({ ...graphRequest, account });
      const ok       = await fetchAndStorePhoto(response.accessToken);
      if (ok) { setUserPhoto(sessionStorage.getItem('userPhoto')); setNeedsConsent(false); }
    } catch (e) {
      console.info('Photo consent dismissed:', e?.message);
    } finally { setConnecting(false); }
  };

  const toggleLang = () => {
    const next = i18n.language === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(next);
    localStorage.setItem('agentpm_lang', next);
  };

  const initials = userName
    ? userName.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
    : userEmail[0]?.toUpperCase() || '?';
  const firstName = userName.split(' ')[0];

  return (
    <nav style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      className="sticky top-0 z-40 backdrop-blur-sm bg-white/95">
      <div className="max-w-7xl mx-auto px-6 flex items-center h-14 gap-6">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent)' }}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <span className="font-bold text-[15px] tracking-tight transition-colors group-hover:opacity-70"
            style={{ color: 'var(--text-1)' }}>
            AgentPM
          </span>
        </Link>

        <div className="h-5 w-px" style={{ background: 'var(--border)' }} />

        {/* Nav links */}
        <div className="flex gap-0.5">
          <NavLink to="/" active={pathname === '/'}>{t('nav.projects')}</NavLink>
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">

          {/* Language toggle */}
          <button
            onClick={toggleLang}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all"
            style={{ color: 'var(--text-2)', borderColor: 'var(--border)', background: 'var(--surface-2)' }}
            title={i18n.language === 'fr' ? 'Switch to English' : 'Passer en français'}
          >
            <span className="text-sm leading-none">
              {i18n.language === 'fr' ? '🇬🇧' : '🇫🇷'}
            </span>
            <span className="hidden sm:inline">
              {i18n.language === 'fr' ? 'EN' : 'FR'}
            </span>
          </button>

          {/* Connect photo button (one-time) */}
          {needsConsent && !userPhoto && (
            <button
              onClick={handleConnectPhoto}
              disabled={connecting}
              className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
              style={{ color: 'var(--accent)', borderColor: 'var(--accent)', background: 'var(--accent-light)' }}
            >
              {connecting
                ? <span className="w-3.5 h-3.5 border-2 border-t-current rounded-full animate-spin" />
                : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>}
              {t('nav.photo')}
            </button>
          )}

          {/* User info */}
          <div className="hidden sm:flex items-center gap-2">
            {userPhoto ? (
              <img src={userPhoto} alt={userName || userEmail} title={userEmail}
                className="w-8 h-8 rounded-full object-cover ring-2 select-none"
                style={{ ringColor: 'var(--border)' }} />
            ) : (
              <div title={userEmail}
                className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center cursor-default select-none"
                style={{ background: 'var(--accent)' }}>
                {initials}
              </div>
            )}
            {firstName && (
              <span className="text-sm hidden md:block truncate max-w-36 select-none"
                style={{ color: 'var(--text-2)' }}>
                {firstName}
              </span>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            title={t('nav.logout')}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors"
            style={{ color: 'var(--text-2)', borderColor: 'var(--border)', background: 'transparent' }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--danger)';
              e.currentTarget.style.borderColor = '#FECACA';
              e.currentTarget.style.background = 'var(--danger-bg)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-2)';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">{t('nav.logout')}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ to, active, children }) {
  return (
    <Link to={to} className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
      style={{ color: active ? 'var(--accent)' : 'var(--text-2)', background: active ? 'var(--accent-light)' : 'transparent' }}>
      {children}
    </Link>
  );
}
