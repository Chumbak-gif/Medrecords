/**
 * Locale-aware formatting utilities using the Intl API.
 *
 * Maps application locale codes to full locale identifiers:
 * - en → en-US
 * - fr → fr-FR
 *
 * Provides date and number formatting functions that respect the user's
 * selected locale. Language selection is persisted to localStorage.
 *
 * Requirements: 12.2, 12.4, 12.6
 */

import i18n from '@/core/i18n/config';

// ---------------------------------------------------------------------------
// Locale mapping
// ---------------------------------------------------------------------------

/**
 * Maps short language codes to full Intl locale identifiers.
 */
const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  fr: 'fr-FR',
};

const LANGUAGE_STORAGE_KEY = 'medrecords-language';

/**
 * Get the full Intl locale string for the current application language.
 */
export function getIntlLocale(): string {
  const currentLang = i18n.language ?? 'en';
  // Handle cases like 'en-US' already being set
  const shortLang = currentLang.split('-')[0];
  return LOCALE_MAP[shortLang] ?? LOCALE_MAP['en'];
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

/**
 * Format a date according to the user's selected locale.
 *
 * @param date - Date value (string, number, or Date object)
 * @param options - Intl.DateTimeFormatOptions for customization
 * @returns Locale-formatted date string
 */
export function formatDate(
  date: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const locale = getIntlLocale();
  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return String(date);
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  };

  return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj);
}

/**
 * Format a date with time according to the user's selected locale.
 */
export function formatDateTime(
  date: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };

  return formatDate(date, defaultOptions);
}

/**
 * Format a date in relative terms (e.g., "2 days ago").
 */
export function formatRelativeDate(date: string | number | Date): string {
  const locale = getIntlLocale();
  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return String(date);
  }

  const now = Date.now();
  const diffMs = now - dateObj.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (Math.abs(diffDays) < 1) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (Math.abs(diffHours) < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return rtf.format(-diffMinutes, 'minute');
    }
    return rtf.format(-diffHours, 'hour');
  }

  if (Math.abs(diffDays) < 30) {
    return rtf.format(-diffDays, 'day');
  }

  const diffMonths = Math.floor(diffDays / 30);
  return rtf.format(-diffMonths, 'month');
}

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

/**
 * Format a number according to the user's selected locale.
 *
 * @param value - Number to format
 * @param options - Intl.NumberFormatOptions for customization
 * @returns Locale-formatted number string
 */
export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  const locale = getIntlLocale();
  return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Format a number as currency.
 */
export function formatCurrency(
  value: number,
  currency: string = 'USD',
  options?: Intl.NumberFormatOptions,
): string {
  const locale = getIntlLocale();
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    ...options,
  }).format(value);
}

/**
 * Format a number as a percentage.
 */
export function formatPercent(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  const locale = getIntlLocale();
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
    ...options,
  }).format(value);
}

// ---------------------------------------------------------------------------
// Language persistence
// ---------------------------------------------------------------------------

/**
 * Persist the selected language to localStorage.
 * Called when the user changes their language preference.
 *
 * Requirement 12.2: persist selection so subsequent loads use same language.
 */
export function persistLanguage(lang: string): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // Ignore storage errors (e.g., quota exceeded, private browsing)
  }
}

/**
 * Restore the persisted language selection from localStorage.
 * Returns the stored language or null if none saved.
 */
export function getPersistedLanguage(): string | null {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Change the application language with persistence and error handling.
 *
 * Requirements: 12.2, 12.6
 * - Persists selection to localStorage
 * - On failure: retains current language, returns error for notification
 */
export async function changeLanguage(lang: string): Promise<{ success: boolean; error?: string }> {
  try {
    await i18n.changeLanguage(lang);
    persistLanguage(lang);
    return { success: true };
  } catch {
    // Requirement 12.6: retain current language on failure, allow retry
    return {
      success: false,
      error: `Failed to load translations for "${lang}". Please try again.`,
    };
  }
}
