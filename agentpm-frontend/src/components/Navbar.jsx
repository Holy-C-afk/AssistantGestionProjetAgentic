import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const { pathname } = useLocation();

  return (
    <nav className="bg-indigo-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-6 flex items-center gap-6 h-14">
        <Link to="/" className="font-bold text-lg tracking-tight">
          AgentPM
        </Link>
        <div className="flex gap-1 ml-4">
          <NavLink to="/" active={pathname === '/'}>
            Projets
          </NavLink>
        </div>
        <div className="ml-auto text-xs text-indigo-300">
          Sprint 3
        </div>
      </div>
    </nav>
  );
}

function NavLink({ to, active, children }) {
  return (
    <Link
      to={to}
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
        active
          ? 'bg-indigo-800 text-white'
          : 'text-indigo-200 hover:bg-indigo-600 hover:text-white'
      }`}
    >
      {children}
    </Link>
  );
}
