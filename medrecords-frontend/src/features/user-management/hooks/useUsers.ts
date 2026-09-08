/**
 * Hooks for user management with TanStack Query.
 *
 * Requirements: 7.1, 4.2
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUsers, createUser, updateUser, type UserFilters, type CreateUserDTO, type UpdateUserDTO } from '../api/usersApi';

const USER_QUERY_KEY = ['users'] as const;

export function useUsers(filters: UserFilters) {
  return useQuery({
    queryKey: [...USER_QUERY_KEY, 'list', filters] as const,
    queryFn: () => fetchUsers(filters),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserDTO) => createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEY });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserDTO }) => updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEY });
    },
  });
}
