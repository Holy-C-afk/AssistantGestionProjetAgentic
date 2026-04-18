import { useAuth } from '../auth/useAuth';

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-10 rounded-2xl shadow-md text-center max-w-sm w-full">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">AgentPM</h1>
        <p className="text-gray-500 mb-8">Connectez-vous avec votre compte Microsoft</p>
        <button
          onClick={login}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-medium flex items-center justify-center gap-3"
        >
          <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
            <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
            <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
          </svg>
          Sign in with Microsoft
        </button>
      </div>
    </div>
  );
}