/**
 * PII URL Guard utility.
 *
 * Ensures patient PII (name, date of birth, contact number, email, medical content)
 * is never exposed in URL parameters or browser history entries.
 *
 * All patient detail routes use numeric IDs only (e.g., /patients/:id).
 * This utility provides:
 * - A validation function to check URLs for PII patterns
 * - Documentation/guidelines for enforcing this policy
 *
 * Requirements: 9.3
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PiiCheckResult {
  safe: boolean;
  violations: string[];
}

// ---------------------------------------------------------------------------
// PII patterns to detect in URLs
// ---------------------------------------------------------------------------

/**
 * Patterns that may indicate PII in a URL.
 * These are intentionally broad to catch potential leaks.
 */
const PII_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  // Email patterns
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, description: 'Email address detected in URL' },
  // Phone number patterns (7+ consecutive digits or formatted phone)
  { pattern: /(?:\+?\d[\d\s-]{6,14}\d)/, description: 'Phone number detected in URL' },
  // Date of birth patterns (YYYY-MM-DD or DD/MM/YYYY or MM/DD/YYYY)
  { pattern: /(?:dob|dateOfBirth|date_of_birth|birthdate|birth_date)=/, description: 'Date of birth parameter detected in URL' },
  // Common PII query parameters
  { pattern: /(?:firstName|lastName|first_name|last_name|fullName|full_name|patient_name|patientName)=/, description: 'Patient name parameter detected in URL' },
  // Contact info parameters
  { pattern: /(?:contactNumber|contact_number|phone|telephone|mobile)=/, description: 'Contact number parameter detected in URL' },
  // Medical content parameters
  { pattern: /(?:diagnosis|medical_record|medicalRecord|treatment|prescription|condition)=[^&]*[a-zA-Z]/, description: 'Medical content detected in URL' },
];

// ---------------------------------------------------------------------------
// Validation functions
// ---------------------------------------------------------------------------

/**
 * Check a URL string for potential PII exposure.
 *
 * @param url - The URL to check (full URL or path with query params)
 * @returns Result indicating whether the URL is safe and any violations found
 */
export function checkUrlForPii(url: string): PiiCheckResult {
  const violations: string[] = [];

  for (const { pattern, description } of PII_PATTERNS) {
    if (pattern.test(url)) {
      violations.push(description);
    }
  }

  return {
    safe: violations.length === 0,
    violations,
  };
}

/**
 * Validate that a route path only uses numeric IDs for patient identification.
 *
 * Valid: /patients/123, /patients/456/assessments
 * Invalid: /patients/john-doe, /patients?name=John
 *
 * @param path - The route path to validate
 * @returns true if the path uses only numeric IDs after /patients/
 */
export function isValidPatientRoute(path: string): boolean {
  // Match /patients/<segment> patterns and ensure <segment> is numeric
  const patientSegmentRegex = /\/patients\/([^/]+)/g;
  let match: RegExpExecArray | null;

  while ((match = patientSegmentRegex.exec(path)) !== null) {
    const segment = match[1];
    // Allow "new" for creation routes, otherwise must be numeric
    if (segment !== 'new' && !/^\d+$/.test(segment)) {
      return false;
    }
  }

  return true;
}

/**
 * Sanitize a URL by removing any detected PII query parameters.
 * Returns the URL with PII parameters stripped.
 *
 * @param url - The URL to sanitize
 * @returns Sanitized URL with PII parameters removed
 */
export function sanitizeUrlPii(url: string): string {
  try {
    const parsed = new URL(url, 'http://localhost');
    const piiParams = [
      'firstName', 'lastName', 'first_name', 'last_name',
      'fullName', 'full_name', 'patientName', 'patient_name',
      'email', 'contactNumber', 'contact_number', 'phone',
      'telephone', 'mobile', 'dob', 'dateOfBirth', 'date_of_birth',
      'birthdate', 'birth_date', 'diagnosis', 'medicalRecord',
      'medical_record', 'treatment', 'prescription', 'condition',
    ];

    for (const param of piiParams) {
      parsed.searchParams.delete(param);
    }

    return parsed.pathname + parsed.search;
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

// ---------------------------------------------------------------------------
// Route pattern documentation
// ---------------------------------------------------------------------------

/**
 * Valid patient route patterns.
 *
 * All patient-related routes MUST use numeric IDs only:
 *
 * ✅ Allowed:
 * - /patients (list)
 * - /patients/new (create form)
 * - /patients/123 (detail by numeric ID)
 * - /patients/123/assessments (nested by numeric ID)
 *
 * ❌ Not allowed:
 * - /patients/john-doe (name in URL)
 * - /patients?name=John&dob=1990-01-01 (PII in query params)
 * - /patients?email=john@example.com (email in query params)
 * - /patients?phone=+1234567890 (phone in query params)
 *
 * This policy ensures PII is never exposed in browser history,
 * bookmarks, referrer headers, or server access logs.
 */
export const PATIENT_ROUTE_POLICY = {
  allowedPatterns: [
    '/patients',
    '/patients/new',
    '/patients/:id',
    '/patients/:id/assessments',
    '/patients/:id/assessments/:assessmentId',
  ],
  forbiddenInUrls: [
    'Patient name (first, last, full)',
    'Date of birth',
    'Contact number / phone',
    'Email address',
    'Medical record content',
    'Diagnosis information',
  ],
} as const;
