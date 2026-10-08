/**
 * Change Password page — shown when the authenticated user must change
 * their password before continuing (first login or after an admin reset).
 *
 * On success, refreshes the user profile (clearing mustChangePassword) and
 * redirects to the role-based dashboard.
 */

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { createTypedApiClient } from '@/shared/services/api/apiClient';

const roleDashboard: Record<string, string> = {
  doctor: '/doctor/dashboard',
  admin: '/admin/analytics',
  pharma_viewer: '/pharma/analytics',
  sys_admin: '/admin/analytics',
};

const apiClient = createTypedApiClient();

export function ChangePasswordPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  function validate(): string | null {
    if (!currentPassword.trim()) return 'Current password is required';
    if (newPassword.length < 8) return 'New password must be at least 8 characters';
    if (!/\d/.test(newPassword)) return 'New password must contain at least one digit';
    if (newPassword !== confirmPassword) return 'Passwords do not match';
    if (newPassword === currentPassword) return 'New password must be different from the current password';
    return null;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      // Refresh the profile so mustChangePassword is cleared in state.
      const { getProfile } = await import('@/features/authentication/store/authSlice');
      await dispatch(getProfile());

      const role = user?.role;
      navigate(role ? (roleDashboard[role] ?? '/admin/analytics') : '/login', { replace: true });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Failed to change password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="card login-card">
        <div className="login-header">
          <h1 className="login-title">MEDRecords</h1>
          <p className="login-subtitle">You must change your password to continue</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field" style={{ marginBottom: '20px' }}>
            <label htmlFor="currentPassword" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-neutral-800)' }}>
              Current Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Enter your current password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isSubmitting}
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowCurrentPassword((v) => !v)}
                disabled={isSubmitting}
                aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                <i className={showCurrentPassword ? 'pi pi-eye-slash' : 'pi pi-eye'} />
              </button>
            </div>
          </div>

          <div className="form-field" style={{ marginBottom: '20px' }}>
            <label htmlFor="newPassword" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-neutral-800)' }}>
              New Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Min 8 characters, at least one digit"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isSubmitting}
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowNewPassword((v) => !v)}
                disabled={isSubmitting}
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                <i className={showNewPassword ? 'pi pi-eye-slash' : 'pi pi-eye'} />
              </button>
            </div>
          </div>

          <div className="form-field" style={{ marginBottom: '20px' }}>
            <label htmlFor="confirmPassword" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-neutral-800)' }}>
              Confirm New Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Re-enter new password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword((v) => !v)}
                disabled={isSubmitting}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                <i className={showConfirmPassword ? 'pi pi-eye-slash' : 'pi pi-eye'} />
              </button>
            </div>
          </div>

          {error && (
            <div className="alert-error" role="alert" style={{ marginBottom: '20px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary login-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Updating...
              </>
            ) : (
              'Change Password'
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
        .password-toggle-btn {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-neutral-500);
          cursor: pointer;
          line-height: 1;
        }
        .password-toggle-btn:hover {
          color: var(--color-neutral-700);
        }
        .password-toggle-btn:disabled {
          cursor: default;
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}

export default ChangePasswordPage;
