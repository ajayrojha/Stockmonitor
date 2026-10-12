import { Link } from 'react-router';

export const NotFoundPage = () => (
  <div className="auth-screen">
    <div className="glass-card auth-card">
      <h1 className="auth-title">Page not found</h1>
      <p className="text-secondary">That address doesn't match any page.</p>
      <Link to="/dashboard" className="btn-primary">
        Go to the dashboard
      </Link>
    </div>
  </div>
);
