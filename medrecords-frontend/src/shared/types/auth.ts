/**
 * Authentication and session management TypeScript types.
 *
 * Defines user profiles, roles, credentials, token responses,
 * and the authentication state shape managed by the Auth Module.
 */

export type UserRole = 'admin' | 'sys_admin' | 'doctor' | 'nurse' | 'receptionist' | 'auditor' | 'pharma_viewer';

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  specialty: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;
}

export interface AuthError {
  message: string;
  code?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  user_id: number;
  full_name: string;
  must_change_password: boolean;
}
