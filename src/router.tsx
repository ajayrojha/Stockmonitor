import { Navigate, createHashRouter } from 'react-router';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Dashboard } from './components/Dashboard';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Hash URLs (/#/dashboard) because GitHub Pages can't send every path to
// index.html. Switch to createBrowserRouter once a real server hosts the app.
export const router = createHashRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <Dashboard /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
