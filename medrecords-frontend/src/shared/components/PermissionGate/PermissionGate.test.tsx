import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { PermissionGate } from './PermissionGate';
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

function renderWithStore(ui: React.ReactElement, authState: AuthState) {
  const store = createTestStore(authState);
  return render(<Provider store={store}>{ui}</Provider>);
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

describe('PermissionGate', () => {
  const readPatients: Permission = { resource: 'patients', action: 'read' };
  const createAssessments: Permission = { resource: 'assessments', action: 'create' };
  const manageUsers: Permission = { resource: 'users', action: 'manage' };

  it('renders children when user has the required permission', () => {
    renderWithStore(
      <PermissionGate permission={readPatients}>
        <span data-testid="content">Protected Content</span>
      </PermissionGate>,
      authenticatedState(doctorUser),
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('renders nothing when user lacks the required permission', () => {
    renderWithStore(
      <PermissionGate permission={manageUsers}>
        <span data-testid="content">Protected Content</span>
      </PermissionGate>,
      authenticatedState(receptionistUser),
    );

    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('renders nothing when user is not authenticated (null user)', () => {
    renderWithStore(
      <PermissionGate permission={readPatients}>
        <span data-testid="content">Protected Content</span>
      </PermissionGate>,
      unauthenticatedState,
    );

    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('renders children unconditionally when permissions array is empty', () => {
    renderWithStore(
      <PermissionGate permission={[] as unknown as Permission[]}>
        <span data-testid="content">Unrestricted Content</span>
      </PermissionGate>,
      authenticatedState(receptionistUser),
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('renders children with empty permissions even when user is not authenticated', () => {
    renderWithStore(
      <PermissionGate permission={[] as unknown as Permission[]}>
        <span data-testid="content">Unrestricted Content</span>
      </PermissionGate>,
      unauthenticatedState,
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  describe('requireAll=false (default)', () => {
    it('renders children when user has at least one of multiple permissions', () => {
      renderWithStore(
        <PermissionGate permission={[readPatients, createAssessments]}>
          <span data-testid="content">Content</span>
        </PermissionGate>,
        authenticatedState(receptionistUser), // has patients:read but not assessments:create
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('renders nothing when user has none of the required permissions', () => {
      renderWithStore(
        <PermissionGate permission={[createAssessments, manageUsers]}>
          <span data-testid="content">Content</span>
        </PermissionGate>,
        authenticatedState(receptionistUser), // has neither
      );

      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    });
  });

  describe('requireAll=true', () => {
    it('renders children when user has all required permissions', () => {
      renderWithStore(
        <PermissionGate permission={[readPatients, createAssessments]} requireAll>
          <span data-testid="content">Content</span>
        </PermissionGate>,
        authenticatedState(doctorUser), // has both patients:read and assessments:create
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('renders nothing when user is missing one of the required permissions', () => {
      renderWithStore(
        <PermissionGate permission={[readPatients, createAssessments]} requireAll>
          <span data-testid="content">Content</span>
        </PermissionGate>,
        authenticatedState(receptionistUser), // has patients:read but not assessments:create
      );

      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    });
  });

  describe('admin role', () => {
    it('renders children for admin regardless of the permission', () => {
      renderWithStore(
        <PermissionGate permission={manageUsers}>
          <span data-testid="content">Admin Content</span>
        </PermissionGate>,
        authenticatedState(adminUser),
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('renders children for admin with requireAll and multiple permissions', () => {
      renderWithStore(
        <PermissionGate permission={[readPatients, createAssessments, manageUsers]} requireAll>
          <span data-testid="content">Admin Content</span>
        </PermissionGate>,
        authenticatedState(adminUser),
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
  });
});
