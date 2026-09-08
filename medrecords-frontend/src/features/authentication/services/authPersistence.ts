/**
 * Session persistence for authentication.
 *
 * Persists the access token and user profile to sessionStorage so a full page
 * reload keeps the user logged in (the token otherwise lives only in memory).
 *
 * sessionStorage (not localStorage) is used deliberately: the session is scoped
 * to the browser tab and cleared when the tab closes, which limits exposure
 * compared to a long-lived localStorage token. If the persisted token is
 * expired on load, it is discarded.
 */

import type { UserProfile } from '@/shared/types';

const STORAGE_KEY = 'medrecords_session';

interface PersistedSession {
  token: string;
  user: UserProfile;
}

/** Parse a JWT's `exp` claim (ms since epoch), or null if unparseable. */
function parseTokenExpiry(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isExpired(token: string): boolean {
  const expiresAt = parseTokenExpiry(token);
  if (expiresAt === null) return false; // can't tell — let the API decide
  return Date.now() >= expiresAt;
}

/** Persist the token + user profile for this browser tab. */
export function persistSession(token: string, user: UserProfile): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user } satisfies PersistedSession));
  } catch {
    /* storage unavailable (private mode / quota) — non-fatal */
  }
}

/** Update just the user profile on an existing persisted session. */
export function persistUser(user: UserProfile): void {
  const existing = loadSession();
  if (existing) persistSession(existing.token, user);
}

/** Remove any persisted session. */
export function clearSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Load the persisted session if present and not expired.
 * Returns null (and clears storage) when absent or expired.
 */
export function loadSession(): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    if (!parsed?.token || !parsed?.user) {
      clearSession();
      return null;
    }
    if (isExpired(parsed.token)) {
      clearSession();
      return null;
    }
    return parsed;
  } catch {
    clearSession();
    return null;
  }
}
