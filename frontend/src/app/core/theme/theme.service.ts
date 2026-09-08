import { Injectable, signal } from '@angular/core';

/**
 * ThemeService manages dark/light mode switching with localStorage persistence.
 * Uses Angular signals for reactive state and applies `data-theme` attribute on <html>.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'medrecords-theme';

  /** Reactive signal holding the current theme mode */
  readonly mode = signal<'light' | 'dark'>(this.loadPreference());

  constructor() {
    // Apply theme immediately on service construction so the UI matches stored preference
    this.applyTheme(this.mode());
  }

  /**
   * Toggle between light and dark mode.
   * Updates the signal, applies the data-theme attribute, and persists to localStorage.
   */
  toggle(): void {
    const next = this.mode() === 'light' ? 'dark' : 'light';
    this.mode.set(next);
    this.applyTheme(next);
    this.persistPreference(next);
  }

  /**
   * Load theme preference from localStorage.
   * Returns 'light' if localStorage is unavailable, empty, or contains a corrupted value.
   */
  private loadPreference(): 'light' | 'dark' {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored === 'dark' ? 'dark' : 'light';
    } catch {
      // localStorage unavailable (e.g., private browsing, SecurityError)
      return 'light';
    }
  }

  /**
   * Persist theme preference to localStorage.
   * Silently fails if localStorage is unavailable (private browsing fallback).
   */
  private persistPreference(mode: 'light' | 'dark'): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, mode);
    } catch {
      // localStorage unavailable — preference remains in-memory only
    }
  }

  /**
   * Apply the data-theme attribute on the document's root <html> element.
   */
  private applyTheme(mode: 'light' | 'dark'): void {
    document.documentElement.setAttribute('data-theme', mode);
  }
}
