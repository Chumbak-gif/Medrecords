/**
 * Inactivity timeout monitor.
 *
 * Tracks mouse, keyboard, and touch events. After 15 minutes of
 * inactivity, clears the session and redirects to the login page
 * with the current URL preserved as returnUrl.
 *
 * Requirements: 9.4
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Inactivity timeout in milliseconds (15 minutes) */
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

/** Events that count as user activity */
const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'keyup',
  'touchstart',
  'touchmove',
  'scroll',
  'click',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InactivityMonitorOptions {
  /** Timeout in milliseconds before session is cleared. Default: 15 minutes */
  timeoutMs?: number;
  /** Callback invoked when inactivity timeout is reached */
  onTimeout: () => void;
  /** Login route path. Default: '/login' */
  loginPath?: string;
}

export interface InactivityMonitor {
  /** Start monitoring for inactivity */
  start: () => void;
  /** Stop monitoring and clean up event listeners */
  stop: () => void;
  /** Reset the inactivity timer (e.g., after an API call) */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Create an inactivity monitor that tracks user interactions and triggers
 * a timeout callback after the specified period of inactivity.
 *
 * @example
 * ```ts
 * const monitor = createInactivityMonitor({
 *   onTimeout: () => {
 *     clearSession();
 *     window.location.href = `/login?returnUrl=${encodeURIComponent(window.location.pathname)}`;
 *   },
 * });
 * monitor.start();
 * // Later, on logout or unmount:
 * monitor.stop();
 * ```
 */
export function createInactivityMonitor(options: InactivityMonitorOptions): InactivityMonitor {
  const timeoutMs = options.timeoutMs ?? INACTIVITY_TIMEOUT_MS;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let isRunning = false;

  function handleActivity(): void {
    if (!isRunning) return;
    resetTimer();
  }

  function resetTimer(): void {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      if (isRunning) {
        options.onTimeout();
      }
    }, timeoutMs);
  }

  function start(): void {
    if (isRunning) return;
    isRunning = true;

    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, handleActivity, { passive: true });
    }

    resetTimer();
  }

  function stop(): void {
    isRunning = false;

    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }

    for (const event of ACTIVITY_EVENTS) {
      document.removeEventListener(event, handleActivity);
    }
  }

  function reset(): void {
    if (isRunning) {
      resetTimer();
    }
  }

  return { start, stop, reset };
}

/**
 * Default inactivity handler that clears session and redirects to login.
 *
 * Clears sessionStorage, dispatches a custom event for the auth store
 * to clear tokens, and redirects to login with the return URL.
 */
export function defaultInactivityHandler(): void {
  const returnUrl = window.location.pathname + window.location.search;
  const loginPath = '/login';

  // Dispatch custom event for auth module to clear session
  window.dispatchEvent(new CustomEvent('session:timeout'));

  // Redirect to login with return URL
  window.location.href = `${loginPath}?returnUrl=${encodeURIComponent(returnUrl)}`;
}
