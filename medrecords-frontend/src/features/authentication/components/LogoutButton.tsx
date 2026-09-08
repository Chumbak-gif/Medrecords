/**
 * Logout button component.
 *
 * Dispatches the logout action and redirects to the login page.
 * Requirements: 2.6
 */

import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/app/store';
import { logout } from '../store/authSlice';
import { ROUTES } from '@/shared/constants/routes';

export interface LogoutButtonProps {
  className?: string;
}

export function LogoutButton({ className }: LogoutButtonProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  async function handleLogout() {
    await dispatch(logout());
    navigate(ROUTES.LOGIN, { replace: true });
  }

  return (
    <button
      onClick={handleLogout}
      className={className}
      aria-label="Sign out"
    >
      Sign Out
    </button>
  );
}
