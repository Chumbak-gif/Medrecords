/**
 * Login page matching the Angular LoginComponent UI.
 * Centered card with logo, username/password fields, sign in button.
 * On success, navigates to the role-based dashboard.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { login, clearError } from '@/features/authentication/store/authSlice';

const roleDashboard: Record<string, string> = {
  doctor: '/doctor/dashboard',
  admin: '/admin/analytics',
  pharma_viewer: '/pharma/analytics',
  sys_admin: '/admin/analytics',
};

export function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, error, user } = useAppSelector((state) => state.auth);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ username: false, password: false });

  // If already authenticated, redirect to role dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(roleDashboard[user.role] ?? '/admin/analytics', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // Clear any previous error when the page mounts
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched({ username: true, password: true });
    if (!username.trim() || !password.trim()) return;

    const result = await dispatch(login({ username: username.trim(), password }));
    if (login.fulfilled.match(result)) {
      const role = result.payload.user.role;
      navigate(roleDashboard[role] ?? '/admin/analytics', { replace: true });
    }
  }

  return (
    <div className="login-page">
      <div className="card login-card">
        <div className="login-header">
          <h1 className="login-title">MEDRecords</h1>
          <p className="login-subtitle">Doctor-Patient Assessment Portal</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field" style={{ marginBottom: '20px' }}>
            <label htmlFor="username" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-neutral-800)' }}>
              Username
            </label>
            <input
              id="username"
              type="text"
              className={`form-control ${touched.username && !username.trim() ? 'form-control--error' : ''}`}
              placeholder="Enter your username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, username: true }))}
              disabled={isLoading}
            />
            {touched.username && !username.trim() && (
              <span className="form-error">Username is required</span>
            )}
          </div>

          <div className="form-field" style={{ marginBottom: '20px' }}>
            <label htmlFor="password" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-neutral-800)' }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              className={`form-control ${touched.password && !password.trim() ? 'form-control--error' : ''}`}
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, password: true }))}
              disabled={isLoading}
            />
            {touched.password && !password.trim() && (
              <span className="form-error">Password is required</span>
            )}
          </div>

          {error && (
            <div className="alert-error" role="alert" style={{ marginBottom: '20px' }}>
              {error.message}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary login-btn"
            disabled={isLoading || !username.trim() || !password.trim()}
          >
            {isLoading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--surface-background);
          padding: 24px;
        }
        .login-card {
          width: 100%;
          max-width: 420px;
          padding: 48px 40px 40px;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          background: var(--surface-card);
        }
        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .login-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--color-primary);
          margin: 0 0 6px;
          letter-spacing: -0.5px;
        }
        .login-subtitle {
          font-size: 0.9rem;
          color: var(--color-neutral-500);
          margin: 0;
        }
        .login-btn {
          width: 100%;
          padding: 12px;
          font-size: 1rem;
          font-weight: 600;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.5);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        .form-control--error,
        .form-control--error:hover,
        .form-control--error:focus {
          border-color: var(--color-error);
        }
        .form-control--error:focus {
          box-shadow: 0 0 0 3px var(--color-error-bg);
        }
      `}</style>
    </div>
  );
}

export default LoginPage;
