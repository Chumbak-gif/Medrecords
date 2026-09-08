/**
 * Theme hook managing dark/light mode switching with localStorage persistence.
 * Matches the Angular ThemeService behavior.
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'medrecords-theme';

type ThemeMode = 'light' | 'dark';

function loadPreference(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', mode);
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const pref = loadPreference();
    applyTheme(pref);
    return pref;
  });

  useEffect(() => {
    applyTheme(mode);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, []);

  return { mode, toggle };
}
