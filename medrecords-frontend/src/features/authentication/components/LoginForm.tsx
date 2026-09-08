/**
 * Login form component.
 *
 * Presents username/password fields with a generic error display.
 * On failure, shows a generic "Invalid credentials" message without
 * revealing which field is wrong (Requirement 2.2).
 *
 * Requirements: 2.1, 2.2
 */

import { useState, type FormEvent } from 'react';

export interface LoginFormProps {
  /** Called when the user submits the form with credentials */
  onSubmit: (credentials: { username: string; password: string }) => void;
  /** Whether a login request is currently in progress */
  isLoading: boolean;
  /** Error message to display (generic — no field-specific hints) */
  error: string | null;
}

export function LoginForm({ onSubmit, isLoading, error }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      return;
    }
    onSubmit({ username: username.trim(), password });
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Login form" noValidate>
      {error && (
        <div role="alert" aria-live="assertive" className="login-form__error">
          {error}
        </div>
      )}

      <div className="login-form__field">
        <label htmlFor="login-username">Username</label>
        <input
          id="login-username"
          name="username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={isLoading}
          aria-describedby={error ? 'login-error' : undefined}
        />
      </div>

      <div className="login-form__field">
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          aria-describedby={error ? 'login-error' : undefined}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || !username.trim() || !password.trim()}
        className="login-form__submit"
      >
        {isLoading ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  );
}
