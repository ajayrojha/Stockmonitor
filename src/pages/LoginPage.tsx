import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate, type Location } from 'react-router';
import { z } from 'zod';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../mocks/demoAccounts';

// The schema is the single source of truth for validation and for the form's
// TypeScript type, much like a typed Angular FormGroup with Validators.
const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

type LoginForm = z.infer<typeof loginSchema>;

export const LoginPage = () => {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/dashboard';

  if (status === 'authenticated') return <Navigate to={from} replace />;

  const onSubmit = async ({ email, password }: LoginForm) => {
    setServerError(null);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Could not reach the server. Try again.');
    }
  };

  const fillDemo = (email: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', DEMO_PASSWORD, { shouldValidate: true });
  };

  return (
    <div className="auth-screen">
      <form className="glass-card auth-card" onSubmit={handleSubmit(onSubmit)} noValidate>
        <h1 className="text-gradient auth-title">Stockmonitor</h1>
        <p className="text-secondary auth-subtitle">Sign in to see the live dashboard.</p>

        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="username" aria-invalid={!!errors.email} {...register('email')} />
          {errors.email && <small className="field-error">{errors.email.message}</small>}
        </label>

        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register('password')} />
          {errors.password && <small className="field-error">{errors.password.message}</small>}
        </label>

        {serverError && (
          <p role="alert" className="form-error">
            {serverError}
          </p>
        )}

        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="demo-accounts">
          <p className="text-secondary">Demo accounts (mock API, password {DEMO_PASSWORD}):</p>
          <div className="demo-buttons">
            {DEMO_ACCOUNTS.map(a => (
              <button key={a.email} type="button" className="btn-ghost" onClick={() => fillDemo(a.email)}>
                {a.role[0].toUpperCase() + a.role.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
};
