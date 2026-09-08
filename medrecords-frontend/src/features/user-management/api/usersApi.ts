/**
 * User management API service.
 *
 * Provides typed API calls for admin user management operations.
 * Requirements: 7.1
 */

import { createTypedApiClient } from '@/shared/services/api/apiClient';
import type { UserRole } from '@/shared/types/auth';

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  specialty: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface PaginatedUsersResponse {
  items: User[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UserFilters {
  search?: string;
  role?: UserRole;
  isActive?: boolean;
  page: number;
  pageSize: number;
}

export interface CreateUserDTO {
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  password: string;
  specialty?: string;
}

export interface UpdateUserDTO {
  email?: string;
  fullName?: string;
  role?: UserRole;
  isActive?: boolean;
  specialty?: string | null;
}

const apiClient = createTypedApiClient();

export async function fetchUsers(filters: UserFilters): Promise<PaginatedUsersResponse> {
  const params: Record<string, unknown> = {
    page: filters.page,
    page_size: filters.pageSize,
  };

  if (filters.search) params.search = filters.search;
  if (filters.role) params.role = filters.role;
  if (filters.isActive !== undefined) params.is_active = filters.isActive;

  const response = await apiClient.get<PaginatedUsersResponse>('/users', { params });
  return response.data;
}

export async function createUser(data: CreateUserDTO): Promise<User> {
  const response = await apiClient.post<User>('/users', data);
  return response.data;
}

export async function updateUser(id: number, data: UpdateUserDTO): Promise<User> {
  const response = await apiClient.put<User>(`/users/${id}`, data);
  return response.data;
}
