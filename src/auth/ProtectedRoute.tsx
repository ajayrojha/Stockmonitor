import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './useAuth';

// Wraps every route that needs a signed-in user; the React Router version of
// an Angular CanActivate guard. It only decides what to render: the API must
// still check the token on every request.
export const ProtectedRoute = () => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'checking') {
    return (
      <div className="auth-screen">
        <p className="text-secondary">Checking your session…</p>
      </div>
    );
  }

  if (status === 'anonymous') {
    // Remember where they were going so login can send them back there.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};
