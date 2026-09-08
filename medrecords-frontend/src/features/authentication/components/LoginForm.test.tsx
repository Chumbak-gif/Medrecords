/**
 * Unit tests for LoginForm component.
 *
 * Validates:
 * - Form renders username/password fields
 * - Submit calls onSubmit with credentials
 * - Submit is prevented when fields are empty
 * - Error message is displayed when provided
 * - Loading state disables inputs and button
 * - No field-specific error hints (Requirement 2.2)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    isLoading: false,
    error: null,
  };

  it('renders username and password fields', () => {
    render(<LoginForm {...defaultProps} />);

    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('renders a submit button', () => {
    render(<LoginForm {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('calls onSubmit with trimmed credentials when form is submitted', () => {
    const onSubmit = vi.fn();
    render(<LoginForm {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: '  doctor1  ' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret123' },
    });
    fireEvent.submit(screen.getByRole('form'));

    expect(onSubmit).toHaveBeenCalledWith({
      username: 'doctor1',
      password: 'secret123',
    });
  });

  it('does not call onSubmit when username is empty', () => {
    const onSubmit = vi.fn();
    render(<LoginForm {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret123' },
    });
    fireEvent.submit(screen.getByRole('form'));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not call onSubmit when password is empty', () => {
    const onSubmit = vi.fn();
    render(<LoginForm {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'doctor1' },
    });
    fireEvent.submit(screen.getByRole('form'));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('displays error message when error prop is provided', () => {
    render(<LoginForm {...defaultProps} error="Invalid credentials" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
  });

  it('does not display error when error prop is null', () => {
    render(<LoginForm {...defaultProps} error={null} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('disables inputs and button when isLoading is true', () => {
    render(<LoginForm {...defaultProps} isLoading={true} />);

    expect(screen.getByLabelText('Username')).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows loading text on button when isLoading is true', () => {
    render(<LoginForm {...defaultProps} isLoading={true} />);

    expect(screen.getByRole('button')).toHaveTextContent('Signing in…');
  });

  it('submit button is disabled when both fields are empty', () => {
    render(<LoginForm {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'Sign In' })).toBeDisabled();
  });

  it('does not reveal field-specific error hints (Requirement 2.2)', () => {
    render(<LoginForm {...defaultProps} error="Invalid credentials. Please try again." />);

    // Error is displayed generically — no mention of "username" or "password" in the error
    const alert = screen.getByRole('alert');
    expect(alert.textContent).not.toMatch(/username.*incorrect/i);
    expect(alert.textContent).not.toMatch(/password.*incorrect/i);
  });
});
