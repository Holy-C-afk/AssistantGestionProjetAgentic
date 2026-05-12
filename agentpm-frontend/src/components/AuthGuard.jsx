import { useIsAuthenticated } from '@azure/msal-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { setAuthToken, setUserId } from '../api/api';
import { getMe } from '../api/projectApi';
import { fetchAndStorePhoto } from '../utils/graphPhoto';
import LoginPage from '../pages/LoginPage';

async function loadAzurePhoto(getGraphToken) {
  try {
    const graphToken = await getGraphToken();
    if (!graphToken) {
      sessionStorage.setItem('photoConsentNeeded', 'true');
      window.dispatchEvent(new Event('photoConsentNeeded'));
      return;
    }
    await fetchAndStorePhoto(graphToken);
  } catch {
    // Graph unavailable — not critical
  }
}

function storeUser(user) {
  setUserId(user.id);
  sessionStorage.setItem('userId',    user.id);
  sessionStorage.setItem('userEmail', user.email);
  sessionStorage.setItem('userName',  user.fullName);
}

export default function AuthGuard({ children }) {
  const isAuthenticated = useIsAuthenticated();
  const { getToken, getGraphToken, account } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    (async () => {
      try {
        const token = await getToken();
        console.log('[AuthGuard] getToken result:', token ? `ok (${token.length} chars)` : 'null');
        if (!token) {
          console.warn('[AuthGuard] No token — app will unlock but API calls will have no auth header');
          return;
        }

        setAuthToken(token);

        const azureEmail = account?.username ?? '';
        const azureName  = account?.name     ?? '';
        const cachedId   = sessionStorage.getItem('userId');
        console.log('[AuthGuard] email:', azureEmail, '| cachedId:', cachedId ?? '(none — first login)');

        if (cachedId) {
          // Returning user: restore immediately, sync in background
          setUserId(cachedId);
          getMe(azureEmail, azureName).then(storeUser).catch((e) => {
            console.warn('[AuthGuard] background getMe failed:', e?.response?.status, e?.message);
          });
        } else {
          // First login: must create the user in DB before loading anything
          try {
            const user = await Promise.race([
              getMe(azureEmail, azureName),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('timeout')), 25000)
              ),
            ]);
            storeUser(user);
            console.log('[AuthGuard] first-login user stored:', user?.id);
          } catch (e) {
            console.warn('[AuthGuard] first-login getMe failed:', e?.response?.status, e?.message);
            // Backend slow/down — app unlocks but projects will be empty
          }
        }

        // Photo is always non-blocking
        loadAzurePhoto(getGraphToken).catch(() => {});

      } catch (e) {
        console.error('[AuthGuard] Auth init failed:', e);
      } finally {
        // Always unlock — even if token is null or any step throws
        setReady(true);
      }
    })();
  }, [isAuthenticated]);

  if (!isAuthenticated) return <LoginPage />;
  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <span className="w-7 h-7 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  return children;
}
