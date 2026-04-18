import { useIsAuthenticated } from '@azure/msal-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { setAuthToken } from '../api/api';
import LoginPage from '../pages/LoginPage';

export default function AuthGuard({ children }) {
  const isAuthenticated = useIsAuthenticated();
  const { getToken } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      getToken().then(token => {
        if (token) setAuthToken(token);
        setReady(true);
      });
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) return <LoginPage />;
  if (!ready) return <div className="p-8 text-gray-400">Chargement...</div>;

  return children;
}