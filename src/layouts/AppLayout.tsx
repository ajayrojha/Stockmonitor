import { LogOut } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/useAuth';

// The shell around every signed-in page: top bar plus the routed page below.
// Angular equivalent: an app shell component with <router-outlet>.
export const AppLayout = () => {
  const { user, logout } = useAuth();

  return (
    <>
      <nav className="app-bar">
        <div className="app-bar-left">
          <span className="app-brand">Stockmonitor</span>
          <NavLink to="/dashboard" className="app-link">
            Dashboard
          </NavLink>
        </div>
        {user && (
          <div className="app-bar-right">
            <span className="app-user">{user.name}</span>
            <span className={`role-badge role-${user.role}`}>{user.role}</span>
            <button type="button" className="btn-ghost" onClick={() => void logout()}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </nav>
      <Outlet />
    </>
  );
};
