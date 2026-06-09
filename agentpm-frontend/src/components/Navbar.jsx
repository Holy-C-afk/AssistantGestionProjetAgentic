import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { graphRequest } from '../auth/authConfig';
import { fetchAndStorePhoto } from '../utils/graphPhoto';
import { useAuth } from '../auth/useAuth';

export default function Navbar() {
  const { pathname }           = useLocation();
  const { instance, accounts } = useMsal();
  const account                = accounts[0];
  const { logout }             = useAuth();

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
    window.addEventListener('userPhotoReady',    onReady);
    window.addEventListener('photoConsentNeeded', onConsent);
    return () => {
      window.removeEventListener('userPhotoReady',    onReady);
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

  const initials = userName
    ? userName.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
    : userEmail[0]?.toUpperCase() || '?';

  return (
    <nav className="bg-white/95 backdrop-blur-md border-b border-gray-200/80 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 flex items-center h-14 gap-6">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-bold">A</span>
          </div>
          <span className="font-bold text-gray-900 text-[15px] tracking-tight group-hover:text-indigo-700 transition-colors">
            AgentPM
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex gap-0.5">
          <NavLink to="/" active={pathname === '/'}>Projets</NavLink>
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">

          {/* Name */}
          {userName && (
            <span className="text-sm text-gray-500 hidden sm:block truncate max-w-44 select-none">{userName}</span>
          )}

          {/* Connect photo button (one-time) */}
          {needsConsent && !userPhoto && (
            <button
              onClick={handleConnectPhoto}
              disabled={connecting}
              title="Afficher ma photo de profil Azure"
              className="hidden sm:flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 transition disabled:opacity-50"
            >
              {connecting
                ? <span className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>}
              Photo
            </button>
          )}

          {/* Avatar */}
          {userPhoto ? (
            <img
              src={userPhoto}
              alt={userName || userEmail}
              title={userEmail}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-indigo-100 shadow-sm cursor-default select-none"
            />
          ) : (
            <div
              title={userEmail}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-xs font-bold flex items-center justify-center cursor-default select-none shadow-sm"
            >
              {initials}
            </div>
          )}

          {/* Logout button */}
          <button
            onClick={logout}
            title="Se déconnecter"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>

      </div>
    </nav>
  );
}

function NavLink({ to, active, children }) {
  return (
    <Link
      to={to}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {children}
    </Link>
  );
}
