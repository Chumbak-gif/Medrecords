/**
 * Tests for DOMPurify sanitization utility.
 */

import { describe, it, expect } from 'vitest';
import { sanitizeHtml, sanitize } from './sanitize';

describe('sanitize', () => {
  describe('sanitizeHtml', () => {
    it('should strip script elements', () => {
      const dirty = '<p>Hello</p><script>alert("xss")</script>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('<script');
      expect(clean).not.toContain('alert');
      expect(clean).toContain('<p>Hello</p>');
    });

    it('should strip event handlers', () => {
      const dirty = '<img src="x" onerror="alert(1)">';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('onerror');
      expect(clean).not.toContain('alert');
    });

    it('should strip javascript: URLs', () => {
      const dirty = '<a href="javascript:alert(1)">click</a>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('javascript:');
    });

    it('should preserve safe HTML content', () => {
      const safe = '<p>Hello <strong>World</strong></p>';
      const clean = sanitizeHtml(safe);
      expect(clean).toBe(safe);
    });

    it('should strip iframe elements', () => {
      const dirty = '<iframe src="https://evil.com"></iframe><p>Content</p>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('<iframe');
      expect(clean).toContain('<p>Content</p>');
    });

    it('should handle empty input', () => {
      expect(sanitizeHtml('')).toBe('');
    });

    it('should strip onclick handlers', () => {
      const dirty = '<button onclick="alert(1)">Click</button>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('onclick');
    });
  });

  describe('sanitize', () => {
    it('should return a sanitized string', () => {
      const dirty = '<p>Safe</p><script>evil()</script>';
      const clean = sanitize(dirty);
      expect(clean).not.toContain('<script');
      expect(clean).toContain('<p>Safe</p>');
    });
  });
});
