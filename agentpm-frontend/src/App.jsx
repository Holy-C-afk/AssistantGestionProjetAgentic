import { MsalProvider } from '@azure/msal-react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { msalInstance } from './auth/msalInstance';
import AuthGuard from './components/AuthGuard';
import Navbar from './components/Navbar';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import DashboardPage from './pages/DashboardPage';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';

export default function App() {
  return (
    <ThemeProvider>
      <MsalProvider instance={msalInstance}>
        <BrowserRouter>
          <AuthGuard>
            <ToastProvider>
              <Navbar />
              <Routes>
                <Route path="/"              element={<ProjectsPage />} />
                <Route path="/dashboard"    element={<DashboardPage />} />
                <Route path="/projects/:id" element={<ProjectDetailPage />} />
              </Routes>
            </ToastProvider>
          </AuthGuard>
        </BrowserRouter>
      </MsalProvider>
    </ThemeProvider>
  );
}