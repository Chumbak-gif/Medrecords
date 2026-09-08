/**
 * UI state Redux Toolkit slice.
 *
 * Manages client-side UI state including:
 * - Sidebar collapsed/expanded state
 * - Theme preference (light, dark, system)
 * - Locale (language selection)
 * - Breadcrumb navigation trail
 *
 * Requirements: 4.1
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Breadcrumb {
  label: string;
  path: string;
}

export interface UIState {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  locale: string;
  breadcrumbs: Breadcrumb[];
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: UIState = {
  sidebarCollapsed: false,
  theme: 'system',
  locale: 'en',
  breadcrumbs: [],
};

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    /**
     * Toggle sidebar collapsed state.
     */
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },

    /**
     * Set sidebar collapsed state explicitly.
     */
    setSidebarCollapsed(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
    },

    /**
     * Set the theme preference.
     */
    setTheme(state, action: PayloadAction<'light' | 'dark' | 'system'>) {
      state.theme = action.payload;
    },

    /**
     * Set the current locale (language).
     */
    setLocale(state, action: PayloadAction<string>) {
      state.locale = action.payload;
    },

    /**
     * Set the breadcrumb trail.
     */
    setBreadcrumbs(state, action: PayloadAction<Breadcrumb[]>) {
      state.breadcrumbs = action.payload;
    },

    /**
     * Push a new breadcrumb to the trail.
     */
    pushBreadcrumb(state, action: PayloadAction<Breadcrumb>) {
      state.breadcrumbs.push(action.payload);
    },

    /**
     * Pop the last breadcrumb from the trail.
     */
    popBreadcrumb(state) {
      state.breadcrumbs.pop();
    },

    /**
     * Clear all breadcrumbs.
     */
    clearBreadcrumbs(state) {
      state.breadcrumbs = [];
    },

    /**
     * Reset UI state to defaults.
     */
    resetUI() {
      return initialState;
    },
  },
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const {
  toggleSidebar,
  setSidebarCollapsed,
  setTheme,
  setLocale,
  setBreadcrumbs,
  pushBreadcrumb,
  popBreadcrumb,
  clearBreadcrumbs,
  resetUI,
} = uiSlice.actions;

export default uiSlice.reducer;
