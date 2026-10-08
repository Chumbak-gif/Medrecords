import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import { ProtectedRoute } from './ProtectedRoute';
import type { Permission } from '@/shared/types/common';
import type { UserProfile, AuthState } from '@/shared/types/auth';

/**
 * Helper to create a Redux store with a given auth state for testing.
 */
function createTestStore(authState: AuthState) {
  return configureStore({
    reducer: {
      auth: () => authState,
    },
  });
}

function renderWithProviders(
  ui: React.ReactElement,
  authState: AuthState,
  initialRoute = '/protected',
) {
  const store = createTestStore(authState);
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/protected" element={ui} />
          <Route path="/login" element={<span data-testid="login-page">Login Page</span>} />
          <Route path="/unauthorized" element={<span data-testid="unauthorized-page">Unauthorized</span>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

const doctorUser: UserProfile = {
  id: 1,
  username: 'doctor1',
  email: 'doctor@example.com',
  fullName: 'Dr. Smith',
  role: 'doctor',
  specialty: 'General',
  isActive: true,
  mustChangePassword: false,
};

const adminUser: UserProfile = {
  id: 2,
  username: 'admin1',
  email: 'admin@example.com',
  fullName: 'Admin User',
  role: 'admin',
  specialty: null,
  isActive: true,
  mustChangePassword: false,
};

const receptionistUser: UserProfile = {
  id: 3,
  username: 'receptionist1',
  email: 'reception@example.com',
  fullName: 'Jane Doe',
  role: 'receptionist',
  specialty: null,
  isActive: true,
  mustChangePassword: false,
};

const authenticatedState = (user: UserProfile): AuthState => ({
  user,
  token: 'test-token',
  isAuthenticated: true,
  isLoading: false,
  error: null,
});

const unauthenticatedState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

describe('ProtectedRoute', () => {
  const readPatients: Permission = { resource: 'patients', action: 'read' };
  const createAssessments: Permission = { resource: 'assessments', action: 'create' };
  const manageUsers: Permission = { resource: 'users', action: 'manage' };

  describe('authentication checks', () => {
    it('redirects unauthenticated users to /login with returnUrl', () => {
      renderWithProviders(
        <ProtectedRoute permission={readPatients}>
          <span data-testid="content">Protected Content</span>
        </ProtectedRoute>,
        unauthenticatedState,
        '/protected',
      );

      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    it('redirects when user is null even if isAuthenticated is somehow true', () => {
      const badState: AuthState = {
        user: null,
        token: 'stale-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

      renderWithProviders(
        <ProtectedRoute permission={readPatients}>
          <span data-testid="content">Protected Content</span>
        </ProtectedRoute>,
        badState,
        '/protected',
      );

      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });

  describe('authorization checks', () => {
    it('renders children when user has the required single permission', () => {
      renderWithProviders(
        <ProtectedRoute permission={readPatients}>
          <span data-testid="content">Protected Content</span>
        </ProtectedRoute>,
        authenticatedState(doctorUser),
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('redirects to /unauthorized when user lacks the required permission', () => {
      renderWithProviders(
        <ProtectedRoute permission={manageUsers}>
          <span data-testid="content">Protected Content</span>
        </ProtectedRoute>,
        authenticatedState(receptionistUser),
      );

      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
      expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
    });
  });

  describe('multiple permissions with requireAll=false (default)', () => {
    it('renders children when user has at least one of multiple permissions', () => {
      renderWithProviders(
        <ProtectedRoute permission={[readPatients, createAssessments]}>
          <span data-testid="content">Content</span>
        </ProtectedRoute>,
        authenticatedState(receptionistUser), // has patients:read but not assessments:create
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('redirects to /unauthorized when user has none of the required permissions', () => {
      renderWithProviders(
        <ProtectedRoute permission={[createAssessments, manageUsers]}>
          <span data-testid="content">Content</span>
        </ProtectedRoute>,
        authenticatedState(receptionistUser),
      );

      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
      expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
    });
  });

  describe('multiple permissions with requireAll=true', () => {
    it('renders children when user has all required permissions', () => {
      renderWithProviders(
        <ProtectedRoute permission={[readPatients, createAssessments]} requireAll>
          <span data-testid="content">Content</span>
        </ProtectedRoute>,
        authenticatedState(doctorUser), // has both
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('redirects to /unauthorized when user is missing one required permission', () => {
      renderWithProviders(
        <ProtectedRoute permission={[readPatients, createAssessments]} requireAll>
          <span data-testid="content">Content</span>
        </ProtectedRoute>,
        authenticatedState(receptionistUser), // has patients:read but not assessments:create
      );

      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
      expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
    });
  });

  describe('admin role', () => {
    it('renders children for admin regardless of any permission', () => {
      renderWithProviders(
        <ProtectedRoute permission={manageUsers}>
          <span data-testid="content">Admin Content</span>
        </ProtectedRoute>,
        authenticatedState(adminUser),
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('renders children for admin with requireAll and multiple permissions', () => {
      renderWithProviders(
        <ProtectedRoute permission={[readPatients, createAssessments, manageUsers]} requireAll>
          <span data-testid="content">Admin Content</span>
        </ProtectedRoute>,
        authenticatedState(adminUser),
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
  });
});
