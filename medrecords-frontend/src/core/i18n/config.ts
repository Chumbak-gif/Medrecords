/**
 * i18next configuration with feature-namespaced translations.
 *
 * Configures:
 * - i18next core with fallbackLng 'en', supportedLngs ['en', 'fr']
 * - i18next-http-backend for loading translations from /locales/{{lng}}/{{ns}}.json
 * - i18next-browser-languagedetector for automatic language detection
 * - react-i18next integration
 * - Namespace-per-feature loading: common, patients, assessments, auth
 *
 * Requirements: 12.1, 12.3, 12.5
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

const SUPPORTED_LANGUAGES = ['en', 'fr'] as const;
const FALLBACK_LANGUAGE = 'en';
const DEFAULT_NAMESPACE = 'common';

// Feature namespaces that can be loaded on demand
export const NAMESPACES = ['common', 'patients', 'assessments', 'auth'] as const;
export type TranslationNamespace = (typeof NAMESPACES)[number];

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Language settings
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    defaultNS: DEFAULT_NAMESPACE,
    ns: [DEFAULT_NAMESPACE],

    // Backend configuration: loads from /locales/{{lng}}/{{ns}}.json
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    // Language detection configuration
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'medrecords-language',
      caches: ['localStorage'],
    },

    // Interpolation
    interpolation: {
      escapeValue: false, // React already escapes output
    },

    // React-specific options
    react: {
      useSuspense: true,
    },

    // Load namespaces on demand (feature-based code splitting)
    partialBundledLanguages: true,
  });

export default i18n;
export { SUPPORTED_LANGUAGES, FALLBACK_LANGUAGE, DEFAULT_NAMESPACE };
