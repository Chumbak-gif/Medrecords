/**
 * DOMPurify sanitization utility.
 *
 * Wraps DOMPurify to strip:
 * - Script elements
 * - Event handlers (on* attributes)
 * - javascript: URLs
 *
 * Provides a useSanitizedHtml hook for safe rendering in React components.
 *
 * Requirements: 9.2
 */

import DOMPurify, { type Config } from 'dompurify';
import { useMemo } from 'react';

// ---------------------------------------------------------------------------
// DOMPurify configuration
// ---------------------------------------------------------------------------

/**
 * Default DOMPurify configuration that strips dangerous content:
 * - FORBID_TAGS: Explicitly forbid script, style, and iframe
 * - FORBID_ATTR: Explicitly forbid all event handler attributes
 * - ALLOW_UNKNOWN_PROTOCOLS: false to block javascript: URLs
 */
const SANITIZE_CONFIG: Config = {
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: [
    'onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout',
    'onmouseenter', 'onmouseleave', 'onfocus', 'onblur', 'onchange',
    'oninput', 'onsubmit', 'onkeydown', 'onkeyup', 'onkeypress',
    'ondblclick', 'oncontextmenu', 'ondrag', 'ondrop', 'onscroll',
    'ontouchstart', 'ontouchend', 'ontouchmove', 'onanimationstart',
    'onanimationend', 'ontransitionend', 'onwheel', 'onpointerdown',
    'onpointerup', 'onpointermove',
  ],
  ALLOW_UNKNOWN_PROTOCOLS: false,
};

// ---------------------------------------------------------------------------
// Sanitization functions
// ---------------------------------------------------------------------------

/**
 * Sanitize an HTML string, stripping script elements, event handlers,
 * and javascript: URLs.
 *
 * @param dirty - Untrusted HTML string
 * @returns Sanitized HTML string safe for DOM insertion
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ...SANITIZE_CONFIG, RETURN_DOM: false, RETURN_DOM_FRAGMENT: false }) as string;
}

/**
 * Sanitize HTML and return as a TrustedHTML-compatible string.
 * Strips all potentially dangerous content.
 *
 * @param dirty - Untrusted HTML string
 * @returns Sanitized HTML string
 */
export function sanitize(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ...SANITIZE_CONFIG,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  }) as string;
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for safely rendering user-generated HTML content.
 *
 * Returns a memoized object suitable for use with React's
 * dangerouslySetInnerHTML prop, ensuring the HTML is sanitized
 * before rendering.
 *
 * @param html - Untrusted HTML string
 * @returns Object with __html property containing sanitized HTML
 *
 * @example
 * ```tsx
 * function PatientNotes({ content }: { content: string }) {
 *   const sanitizedHtml = useSanitizedHtml(content);
 *   return <div dangerouslySetInnerHTML={sanitizedHtml} />;
 * }
 * ```
 */
export function useSanitizedHtml(html: string): { __html: string } {
  return useMemo(() => {
    return { __html: sanitizeHtml(html) };
  }, [html]);
}
