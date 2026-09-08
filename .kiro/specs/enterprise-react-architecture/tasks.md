# Implementation Plan: Enterprise React Architecture for MEDRecords

## Overview

This implementation plan builds the enterprise-grade React frontend architecture for the MEDRecords medical records portal. The plan follows an incremental approach: establishing foundational infrastructure first (project setup, types, API client), then building security and auth layers, followed by state management, error handling, observability, feature modules, and finally deployment/CI configuration. Each task builds on prior work, ensuring no orphaned code.

## Tasks

- [x] 1. Project scaffolding and core infrastructure
  - [x] 1.1 Initialize Vite project with TypeScript, React, and directory structure
    - Create the `medrecords-frontend/` project using Vite with React-TS template
    - Set up the full directory structure: `src/app/`, `src/shared/`, `src/features/`, `src/core/`, `tests/`
    - Configure `tsconfig.json` with path aliases (`@/shared`, `@/core`, `@/features`, `@/app`)
    - Install core dependencies: react, react-dom, react-router-dom, axios, @reduxjs/toolkit, react-redux, @tanstack/react-query, zod, i18next, react-i18next, dompurify
    - Install dev dependencies: vitest, @testing-library/react, fast-check, eslint, prettier, playwright
    - Configure `vite.config.ts` with manual chunks (vendor, ui, state) per design
    - Configure `vitest.config.ts` with coverage thresholds (80%)
    - _Requirements: 7.1, 10.1, 10.4, 10.6, 11.5_

  - [x] 1.2 Define shared TypeScript types and interfaces
    - Create `src/shared/types/api.ts` with ApiResponse, RequestConfig, ApiClientConfig, PaginatedResponse interfaces
    - Create `src/shared/types/auth.ts` with AuthState, UserProfile, UserRole, LoginCredentials, TokenResponse
    - Create `src/shared/types/common.ts` with Permission, ErrorCategory enum, AppError, LogContext interfaces
    - Create `src/shared/types/index.ts` barrel export
    - _Requirements: 1.9, 2.1, 3.1_

  - [x] 1.3 Define shared constants
    - Create `src/shared/constants/routes.ts` with all route path constants
    - Create `src/shared/constants/permissions.ts` with the ROLE_PERMISSIONS matrix per design
    - Create `src/shared/constants/queryKeys.ts` with typed query key factories for patients, assessments, audit
    - Create `src/shared/constants/index.ts` barrel export
    - _Requirements: 3.1, 4.7_

- [ ] 2. API Client Layer
  - [x] 2.1 Implement the core Axios API client with interceptors
    - Create `src/shared/services/api/apiClient.ts`
    - Implement `createApiClient()` that creates Axios instance with configurable baseURL and timeout (default 30s)
    - Implement request interceptor: attach Bearer token from in-memory store, generate UUID v4 correlation ID as X-Correlation-ID header
    - Implement response interceptor: on 401, attempt token refresh via singleton lock pattern and retry once
    - Implement skipAuth config option to omit Authorization header
    - Create `src/shared/services/api/apiConfig.ts` with environment-based configuration using VITE_API_URL
    - Create `src/shared/services/api/index.ts` barrel export
    - _Requirements: 1.1, 1.2, 1.6, 1.7, 1.8, 1.10_

  - [x] 2.2 Implement retry strategy with exponential backoff
    - Create `src/shared/services/api/retryStrategy.ts`
    - Implement `executeWithRetry<T>()` function with configurable maxAttempts (default 3), baseDelay (1s), maxDelay (10s)
    - Apply exponential backoff: delay = min(baseDelay * 2^attempt + jitter, maxDelay)
    - Only retry on transient failures: network errors, timeouts, HTTP 5xx
    - Immediately propagate non-retryable errors (HTTP 4xx except 401)
    - Integrate retry strategy into the API client request pipeline
    - _Requirements: 1.3, 1.4, 1.5_

  - [x] 2.3 Implement error classifier
    - Create `src/shared/services/api/errorClassifier.ts`
    - Implement `classify(error: unknown): AppError` that categorizes into exactly one ErrorCategory
    - Map: no response → NETWORK, 401 → AUTHENTICATION, 403 → AUTHORIZATION, 400/422 → VALIDATION, 404 → NOT_FOUND, 5xx → SERVER, timeout → TIMEOUT, else → UNKNOWN
    - Always produce non-empty message and ISO 8601 timestamp
    - Implement `isRetryable(error: AppError): boolean`
    - _Requirements: 1.9, 5.7_

  - [ ]* 2.4 Write property tests for error classifier (Property 1)
    - **Property 1: Error Classification Totality**
    - Test that for any input value (undefined, null, Error, AxiosError, arbitrary), classify() returns exactly one valid ErrorCategory with non-empty message and valid timestamp
    - **Validates: Requirements 1.9, 5.7**

  - [ ]* 2.5 Write property tests for auth header and correlation ID (Properties 2, 3)
    - **Property 2: Auth Header Correctness** — Authorization header present with Bearer token iff token exists AND skipAuth is not true
    - **Property 3: Correlation ID Uniqueness** — N requests produce N distinct X-Correlation-ID values, all valid UUIDs
    - **Validates: Requirements 1.1, 1.2, 1.8**

  - [ ]* 2.6 Write property tests for retry strategy (Properties 4, 5)
    - **Property 4: Retry Termination and Exponential Backoff** — retry loop terminates after maxAttempts, delays grow exponentially bounded by maxDelay
    - **Property 5: Non-Retryable Error Immediate Propagation** — HTTP 4xx (excluding 401) invokes request exactly once without retry delay
    - **Validates: Requirements 1.3, 1.4, 1.5**

- [x] 3. Checkpoint - API Client Layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Authentication Module
  - [x] 4.1 Implement auth store with Redux Toolkit slice
    - Create `src/features/authentication/store/authSlice.ts`
    - Define AuthState: user, token (in-memory closure, not in Redux state), isAuthenticated, isLoading, error
    - Implement async thunks: login, logout, refreshToken, getProfile
    - Implement token-in-memory storage via module-level closure variable (never localStorage/sessionStorage)
    - Implement token expiry check with 5-minute pre-refresh window
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.2 Implement token refresh with race condition prevention
    - Create `src/features/authentication/services/tokenRefresh.ts`
    - Implement singleton `refreshTokenWithLock()` — only one refresh in-flight at a time
    - Queue concurrent callers and resolve all with single response
    - On refresh failure: clear auth state, redirect to login with returnUrl
    - _Requirements: 2.5, 2.8_

  - [x] 4.3 Implement multi-tab session synchronization
    - Create `src/features/authentication/services/sessionSync.ts`
    - Use BroadcastChannel API to broadcast logout events
    - On receiving logout from another tab: clear local state, redirect to login with replaceUrl
    - On page load/refresh: attempt silent token refresh via httpOnly cookie
    - _Requirements: 2.6, 2.7, 2.9, 2.10_

  - [x] 4.4 Implement login page and auth forms
    - Create `src/features/authentication/pages/LoginPage.tsx`
    - Create `src/features/authentication/components/LoginForm.tsx`
    - Implement form with username/password fields, generic error display (no field-specific hints)
    - On success: store token in-memory, navigate to dashboard
    - On failure: display generic "Invalid credentials" without revealing which field is wrong
    - _Requirements: 2.1, 2.2_

  - [ ]* 4.5 Write property tests for token storage security and refresh atomicity (Properties 6, 8)
    - **Property 6: Token Refresh Atomicity** — N concurrent 401 responses issue at most one refresh request
    - **Property 8: Token Storage Security** — JWT never appears in localStorage or sessionStorage
    - **Validates: Requirements 2.3, 2.5**

  - [ ]* 4.6 Write property test for logout state completeness (Property 7)
    - **Property 7: Logout State Completeness** — After logout, no in-memory variable or browser storage contains previous user's token or profile
    - **Validates: Requirements 2.6**

- [ ] 5. RBAC Authorization Engine
  - [x] 5.1 Implement RBAC engine with permission matrix
    - Create `src/core/security/rbac.ts` with hasPermission, hasAnyPermission, hasAllPermissions
    - Create `src/core/security/permissions.ts` with immutable ROLE_PERMISSIONS map (Object.freeze)
    - Admin with wildcard always returns true
    - Undefined roles return empty permission set (deny all)
    - _Requirements: 3.1, 3.2, 3.7_

  - [x] 5.2 Implement ProtectedRoute component
    - Create `src/app/router/ProtectedRoute.tsx`
    - Check auth state: unauthenticated → redirect to /login
    - Check permission: unauthorized → redirect to /unauthorized (replace history)
    - Support single or array of permissions with requireAll option
    - _Requirements: 3.3, 3.9_

  - [x] 5.3 Implement PermissionGate component
    - Create `src/shared/components/PermissionGate/PermissionGate.tsx`
    - Render children only if user holds required permission(s)
    - requireAll=true → all permissions needed; requireAll=false/omitted → any one sufficient
    - Empty permissions array → render unconditionally
    - Render nothing (no placeholder) when access denied
    - _Requirements: 3.4, 3.5, 3.6, 3.8_

  - [x] 5.4 Implement usePermission hook
    - Create `src/shared/hooks/usePermission.ts`
    - Memoized permission check that returns { hasAccess, isLoading, user }
    - Support single and array permissions with requireAll option
    - _Requirements: 3.4, 3.5, 3.6_

  - [ ]* 5.5 Write property tests for RBAC (Properties 9, 10)
    - **Property 9: Admin Role Totality** — For any resource/action, admin always returns true
    - **Property 10: Permission Gate Correctness** — PermissionGate renders children iff permission logic is satisfied; denied at route level redirects to /unauthorized
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6**

- [x] 6. Checkpoint - Auth and RBAC
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. State Management Layer
  - [x] 7.1 Configure Redux store with middleware
    - Create `src/app/store/index.ts` with configureStore
    - Create `src/app/store/rootReducer.ts` combining auth, ui, notifications slices
    - Create `src/app/store/middleware/logger.ts` for dev logging
    - Create `src/app/store/middleware/telemetry.ts` for action tracking
    - _Requirements: 4.1_

  - [x] 7.2 Implement UI and notifications Redux slices
    - Create `src/app/store/uiSlice.ts` managing sidebar, theme, locale, breadcrumbs
    - Create `src/app/store/notificationsSlice.ts` managing notification items and unread count
    - _Requirements: 4.1_

  - [x] 7.3 Configure TanStack Query with defaults and query client
    - Create `src/shared/services/api/queryClient.ts`
    - Configure default staleTime (30s), gcTime (5min), stale-while-revalidate
    - Implement global error handler for failed background refetches (show non-blocking notification)
    - Wire query key factories from constants
    - _Requirements: 4.2, 4.3, 4.4, 4.7_

  - [x] 7.4 Implement optimistic mutation pattern with rollback
    - Create `src/shared/hooks/useOptimisticMutation.ts`
    - Implement cache snapshot before mutation, optimistic cache update
    - On server rejection: rollback cache to snapshot, show failure notification
    - On success: invalidate related query keys
    - _Requirements: 4.5, 4.6_

  - [ ]* 7.5 Write property test for optimistic update rollback (Property 11)
    - **Property 11: Optimistic Update Rollback** — When server rejects mutation, state reverts to pre-mutation state with no residual optimistic data
    - **Validates: Requirements 4.5, 4.6**

- [x] 8. Error Handling Infrastructure
  - [x] 8.1 Implement ErrorBoundary component with fallback UI
    - Create `src/core/error-handling/ErrorBoundary.tsx`
    - Catch unhandled exceptions within Feature_Module component trees
    - Display fallback UI without crashing entire application
    - Support resetKeys for recovery
    - Report caught errors to telemetry
    - _Requirements: 5.1, 5.5_

  - [x] 8.2 Implement error reporter and notification system
    - Create `src/core/error-handling/errorReporter.ts`
    - Report errors with correlationId, category, timestamp, userId, route, feature module name
    - Create toast notification service: network errors show connection toast, server errors show correlation ID + retry button
    - Chunk load failure → "New version available" with reload button
    - _Requirements: 5.2, 5.4, 5.5, 5.6_

  - [x] 8.3 Implement form error mapping from server validation errors
    - Create `src/shared/utils/formErrorMapper.ts`
    - Map HTTP 422 field errors to form field paths
    - Display inline error messages adjacent to each invalid field
    - _Requirements: 5.3_

  - [x] 8.4 Implement form data preservation on error boundary recovery
    - Create `src/core/error-handling/FormRecovery.tsx`
    - Preserve unsaved form data when ErrorBoundary catches an error
    - Offer recovery option to restore form state after re-render
    - _Requirements: 5.8_

  - [ ]* 8.5 Write property tests for error boundary containment and field mapping (Properties 12, 13, 14)
    - **Property 12: Error Boundary Containment** — Exception in Feature_Module caught by nearest ErrorBoundary; other modules remain functional
    - **Property 13: Validation Error Field Mapping** — N field errors → exactly N inline messages mapped to correct fields
    - **Property 14: Error Report Completeness** — Every error report includes correlationId, ErrorCategory, timestamp, context
    - **Validates: Requirements 5.1, 5.3, 5.4, 5.5**

- [x] 9. Checkpoint - State Management and Error Handling
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Observability and Telemetry
  - [x] 10.1 Initialize OpenTelemetry SDK with trace context propagation
    - Create `src/core/monitoring/telemetry.ts`
    - Set up WebTracerProvider with OTLP exporter
    - Configure W3C Trace Context propagation to backend
    - Implement BatchSpanProcessor with 30s export interval or 50-entry batch threshold
    - Buffer up to 500 entries when collector unreachable
    - In non-production: log to console only, no external export
    - _Requirements: 6.1, 6.6, 6.7, 6.8_

  - [x] 10.2 Implement structured logger
    - Create `src/core/logging/logger.ts`
    - Emit structured JSON logs with: level, message, ISO 8601 timestamp, correlationId, userId, feature
    - In production: export to collector; in dev: console output
    - Create `src/core/logging/logLevels.ts`
    - _Requirements: 6.3, 6.8_

  - [x] 10.3 Implement API call telemetry spans
    - Create `src/core/monitoring/spans.ts`
    - Instrument API client to create trace span per request with HTTP method, URL, duration, status
    - _Requirements: 6.2_

  - [x] 10.4 Implement Web Vitals monitoring and route navigation spans
    - Create `src/core/monitoring/webVitals.ts`
    - Track LCP, FID, CLS, TTFB, INP and export to collector
    - Create route navigation span recording source and destination routes
    - _Requirements: 6.4, 6.5_

  - [ ]* 10.5 Write property tests for telemetry (Properties 15, 16, 17)
    - **Property 15: API Telemetry Span Creation** — Every API request creates a span with method, URL, duration, status
    - **Property 16: Structured Log Completeness** — Every log emission is valid JSON with level, message, timestamp
    - **Property 17: Navigation Span Recording** — Every route navigation records source and destination paths
    - **Validates: Requirements 6.2, 6.3, 6.5**

- [x] 11. Data Validation with Zod
  - [x] 11.1 Implement patient Zod schemas
    - Create `src/features/patient-management/models/patient.validation.ts`
    - Implement patientSchema: firstName/lastName non-empty max 100, dateOfBirth valid ISO 8601 not future, gender enum, contactNumber regex 7-15 digits with optional +, email optional valid format
    - _Requirements: 8.1, 8.3, 8.4, 8.5, 8.6_

  - [x] 11.2 Implement assessment validation with dynamic template schemas
    - Create `src/features/assessments/models/assessment.validation.ts`
    - Validate formData against template schema: required fields, min/max, minLength/maxLength, pattern
    - Display errors adjacent to invalid fields, prevent submission until resolved
    - _Requirements: 8.7, 8.8_

  - [x] 11.3 Integrate Zod with react-hook-form via zodResolver
    - Create `src/shared/hooks/useValidatedForm.ts`
    - Wire zodResolver for client-side validation before submission
    - Display error messages adjacent to each invalid field
    - _Requirements: 8.1, 8.2_

  - [ ]* 11.4 Write property test for patient schema validation (Property 19)
    - **Property 19: Patient Schema Validation Correctness** — Schema accepts valid data and rejects invalid data per specification
    - **Validates: Requirements 8.1, 8.3, 8.4, 8.5, 8.6**

- [x] 12. Security Infrastructure
  - [x] 12.1 Configure CSP and security headers in nginx
    - Create `nginx.conf` with Content-Security-Policy: scripts restricted to self-origin
    - Set X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin
    - Enable gzip compression level 6 for text/plain, text/css, application/json, application/javascript
    - Set Cache-Control with immutable for hashed static assets
    - _Requirements: 9.1, 9.7, 11.6, 11.7_

  - [x] 12.2 Implement DOMPurify sanitization utility
    - Create `src/core/security/sanitize.ts`
    - Wrap DOMPurify to strip script elements, event handlers, javascript: URLs
    - Provide useSanitizedHtml hook for safe rendering
    - _Requirements: 9.2_

  - [x] 12.3 Implement inactivity timeout
    - Create `src/core/security/inactivityMonitor.ts`
    - Track mouse, keyboard, touch events; after 15 minutes of inactivity, clear session and redirect to login with returnUrl
    - _Requirements: 9.4_

  - [x] 12.4 Ensure PII not exposed in URLs
    - Verify all patient detail routes use numeric IDs only (e.g., /patients/:id)
    - Ensure no patient name, DOB, contact, email, or medical content appears in URL params or history
    - _Requirements: 9.3_

  - [ ]* 12.5 Write property test for HTML sanitization (Property 20)
    - **Property 20: HTML Sanitization Safety** — For any arbitrary HTML input, output contains no script elements, no event handlers, no javascript: URLs
    - **Validates: Requirements 9.2**

- [x] 13. Checkpoint - Security and Validation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Modular Feature Architecture
  - [x] 14.1 Implement feature module structure for patient-management
    - Create `src/features/patient-management/` with api/, components/, pages/, hooks/, store/, models/, routes.ts
    - Implement patient API service using shared apiClient
    - Implement usePatients and useCreatePatient hooks with TanStack Query
    - Create PatientsListPage with DataTable, PermissionGate for create button
    - Create PatientForm with Zod validation
    - _Requirements: 7.1, 7.3, 8.1_

  - [x] 14.2 Implement feature module structure for assessments
    - Create `src/features/assessments/` with full module structure
    - Implement assessment API service, hooks, pages
    - Implement dynamic form rendering with template-based Zod validation
    - _Requirements: 7.1, 8.7, 8.8_

  - [x] 14.3 Implement feature module structure for authentication
    - Wire `src/features/authentication/` routes, consolidate LoginPage, LogoutButton
    - Register feature routes in main router
    - _Requirements: 7.1_

  - [x] 14.4 Implement feature modules for dashboard, audit, and user-management
    - Create `src/features/dashboard/` with DashboardPage
    - Create `src/features/audit/` with AuditPage, audit log table with filters
    - Create `src/features/user-management/` with admin user management
    - _Requirements: 7.1, 7.4_

  - [ ]* 14.5 Write property test for code split independence (Property 18)
    - **Property 18: Code Split Independence** — Navigating to F1's route downloads only F1's bundle, not F2's
    - **Validates: Requirements 7.2**

- [x] 15. Router and Lazy Loading
  - [x] 15.1 Implement router configuration with lazy-loaded feature routes
    - Create `src/app/router/index.tsx` with React Router configuration
    - Create `src/app/router/LazyRoutes.tsx` with React.lazy() for each feature module
    - Wrap lazy components in Suspense with LoadingSpinner fallback
    - Apply ProtectedRoute guards with required permissions per route
    - Feature bundles should each be under 100KB gzipped
    - _Requirements: 7.2, 10.2, 10.4_

  - [x] 15.2 Implement application shell and provider composition
    - Create `src/app/App.tsx` root component
    - Create `src/app/providers/AppProviders.tsx` composing ErrorBoundary, Redux, QueryClient, Telemetry, Auth, Theme
    - Create `src/app/layouts/MainLayout.tsx` with Header, Sidebar, Footer
    - Create `src/app/layouts/AuthLayout.tsx` for login page
    - _Requirements: 5.1, 7.1_

- [x] 16. Performance Optimization
  - [x] 16.1 Configure Vite build optimization and chunk splitting
    - Configure `vite.config.ts` manualChunks: vendor (react, react-dom, react-router-dom), ui (primereact), state (@reduxjs/toolkit, react-redux, @tanstack/react-query)
    - Enable content-hash filenames for cache busting
    - Configure tree-shaking and minification
    - Verify initial bundle < 200KB gzipped, feature chunks < 100KB
    - _Requirements: 10.1, 10.4, 10.6_

  - [x] 16.2 Implement virtual scrolling for large data tables
    - Create `src/shared/components/DataTable/VirtualDataTable.tsx`
    - Use virtualization for tables exceeding 1000 rows
    - Maintain 30fps during scroll, no frame > 50ms
    - _Requirements: 10.5_

- [x] 17. Internationalization
  - [x] 17.1 Configure i18next with feature-namespaced translations
    - Create `src/core/i18n/config.ts` with i18next, http-backend, language-detector, react-i18next
    - Configure fallbackLng: 'en', supportedLngs: ['en', 'fr']
    - Set up namespace-per-feature loading from `/locales/{{lng}}/{{ns}}.json`
    - Create `public/locales/en/common.json` and `public/locales/fr/common.json` with base translations
    - Create feature-specific namespace files (patients, assessments, auth)
    - _Requirements: 12.1, 12.3, 12.5_

  - [x] 17.2 Implement locale-aware formatting and language persistence
    - Create `src/shared/utils/format.ts` with date/number formatting using Intl API
    - en → en-US locale, fr → fr-FR locale
    - Persist language selection to localStorage and restore on load
    - Handle translation file load failure: retain current language, show error notification, allow retry
    - _Requirements: 12.2, 12.4, 12.6_

  - [ ]* 17.3 Write property test for locale-aware formatting (Property 21)
    - **Property 21: Locale-Aware Formatting Consistency** — For any date/number and supported locale, formatting output matches Intl API conventions; switching locale changes output
    - **Validates: Requirements 12.4**

- [x] 18. Deployment Infrastructure
  - [x] 18.1 Create multi-stage Dockerfile and health endpoint
    - Create `Dockerfile` with multi-stage build: node for build, alpine nginx for serve
    - Final image ≤ 150MB uncompressed
    - Configure nginx to serve SPA with fallback to index.html
    - Implement `/health` endpoint returning JSON `{"status": "ok"}` (HTTP 200) or `{"status": "unavailable"}` (HTTP 503)
    - _Requirements: 11.1, 11.2, 11.8_

  - [x] 18.2 Create docker-compose and environment configuration
    - Create `docker-compose.yml` for local development
    - Create `.env.development`, `.env.staging`, `.env.production` with VITE_API_URL and VITE_ENV
    - _Requirements: 11.5_

  - [x] 18.3 Create CI/CD pipeline configuration
    - Create `.github/workflows/ci.yml`
    - Stages: install (npm ci --frozen-lockfile), lint, typecheck, unit tests with coverage, build, security scan (npm audit)
    - Block merge on: lint failure, type errors, test failures, coverage < 80%, critical/high vulnerabilities
    - _Requirements: 11.3, 11.4, 9.5, 9.6_

- [x] 19. Final Checkpoint - Full Integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (21 total properties)
- Unit tests validate specific examples and edge cases
- TypeScript is the implementation language throughout (as specified in the design)
- The architecture integrates with the existing FastAPI backend at the configured VITE_API_URL

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "5.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "5.2", "5.3", "5.4"] },
    { "id": 4, "tasks": ["2.4", "2.5", "2.6", "5.5"] },
    { "id": 5, "tasks": ["4.1", "7.1"] },
    { "id": 6, "tasks": ["4.2", "4.3", "7.2", "7.3"] },
    { "id": 7, "tasks": ["4.4", "4.5", "4.6", "7.4"] },
    { "id": 8, "tasks": ["7.5", "8.1", "10.1"] },
    { "id": 9, "tasks": ["8.2", "8.3", "8.4", "10.2", "10.3"] },
    { "id": 10, "tasks": ["8.5", "10.4", "10.5"] },
    { "id": 11, "tasks": ["11.1", "11.2", "11.3", "12.1", "12.2", "12.3", "12.4"] },
    { "id": 12, "tasks": ["11.4", "12.5", "17.1"] },
    { "id": 13, "tasks": ["14.1", "14.2", "14.3", "17.2"] },
    { "id": 14, "tasks": ["14.4", "14.5", "15.1", "17.3"] },
    { "id": 15, "tasks": ["15.2", "16.1", "16.2"] },
    { "id": 16, "tasks": ["18.1", "18.2"] },
    { "id": 17, "tasks": ["18.3"] }
  ]
}
```
