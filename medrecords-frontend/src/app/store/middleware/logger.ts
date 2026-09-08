/**
 * Development logging middleware for Redux store.
 *
 * Logs dispatched actions, previous state, and next state to the console
 * in development mode only. Disabled in production builds.
 *
 * Requirements: 4.1
 */

import type { Middleware } from '@reduxjs/toolkit';

/**
 * Logger middleware that outputs action type, payload, and state changes
 * to the browser console during development.
 */
export const loggerMiddleware: Middleware = (storeAPI) => (next) => (action) => {
  if (import.meta.env.DEV) {
    const typedAction = action as { type?: string; payload?: unknown };
    const prevState = storeAPI.getState();

    console.group(`%c[Redux] ${typedAction.type ?? 'unknown'}`, 'color: #6366f1; font-weight: bold;');
    console.log('%cprev state', 'color: #9ca3af;', prevState);
    console.log('%caction', 'color: #3b82f6;', action);

    const result = next(action);

    const nextState = storeAPI.getState();
    console.log('%cnext state', 'color: #22c55e;', nextState);
    console.groupEnd();

    return result;
  }

  return next(action);
};
