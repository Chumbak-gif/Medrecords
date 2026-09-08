export interface UserProfile {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: 'doctor' | 'admin' | 'pharma_viewer' | 'sys_admin';
  specialty?: string;
  is_active: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  role: string;
  user_id: number;
  full_name: string;
}
