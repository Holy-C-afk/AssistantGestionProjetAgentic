import { useIsAuthenticated } from '@azure/msal-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { setAuthToken, setUserId } from '../api/api';
import { getMe } from '../api/projectApi';
import LoginPage from '../pages/LoginPage';

export default function AuthGuard({ children }) {
  const isAuthenticated = useIsAuthenticated();
  const { getToken } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    getToken().then(async token => {
      if (token) {
        setAuthToken(token);
        try {
          const user = await getMe();
          setUserId(user.id);
          sessionStorage.setItem('userId', user.id);
          sessionStorage.setItem('userEmail', user.email);
          sessionStorage.setItem('userName', user.fullName);
        } catch (e) {
          console.error('Auth/me failed', e);
        }
      }
      setReady(true);
    });
  }, [isAuthenticated]);

  if (!isAuthenticated) return <LoginPage />;
  if (!ready) return <div className="p-8 text-gray-400">Chargement...</div>;

  return children;
}
