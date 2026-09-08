/**
 * Root reducer combining all Redux slices.
 *
 * Combines auth, ui, and notifications slices into the root state.
 * Each slice manages its own domain of client-side state.
 *
 * Requirements: 4.1
 */

import { combineReducers } from '@reduxjs/toolkit';
import authReducer from '@/features/authentication/store/authSlice';
import uiReducer from './uiSlice';
import notificationsReducer from './notificationsSlice';

// ---------------------------------------------------------------------------
// Root reducer
// ---------------------------------------------------------------------------

export const rootReducer = combineReducers({
  auth: authReducer,
  ui: uiReducer,
  notifications: notificationsReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
