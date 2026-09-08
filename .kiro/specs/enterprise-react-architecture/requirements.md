# Requirements Document

## Introduction

This document defines the requirements for the Enterprise React Architecture of the MEDRecords medical records portal. The system provides a modern, enterprise-grade frontend application that integrates with the existing Python/FastAPI backend, supporting role-based access control, secure authentication, structured error handling, observability, and scalable modular development.

## Glossary

- **API_Client**: The centralized HTTP communication layer built on Axios that handles all outbound requests to the FastAPI backend, including authentication headers, correlation IDs, retries, and error classification.
- **Auth_Module**: The authentication subsystem responsible for login/logout flows, JWT token lifecycle management, secure in-memory token storage, and multi-tab session synchronization.
- **RBAC_Engine**: The Role-Based Access Control authorization engine that evaluates user permissions against a defined permission matrix to grant or deny access to routes and UI elements.
- **State_Manager**: The state management layer combining Redux Toolkit for client/UI state and TanStack Query for server-side data caching, fetching, and synchronization.
- **Error_Handler**: The unified error handling infrastructure that classifies errors, displays user-friendly messages, manages Error Boundaries, and reports errors to telemetry.
- **Telemetry_System**: The observability layer using OpenTelemetry for distributed tracing, structured logging with correlation IDs, and Web Vitals performance monitoring.
- **Feature_Module**: A self-contained code module organized as a DDD bounded context with its own API layer, components, pages, hooks, store, and type definitions.
- **Permission**: A resource-action pair (e.g., patients:read) that defines a specific capability within the system.
- **Correlation_ID**: A unique identifier attached to every API request for distributed tracing and error correlation across frontend and backend.
- **Error_Boundary**: A React component that catches JavaScript errors in its child component tree and displays a fallback UI instead of crashing the application.
- **UserRole**: One of five defined roles in the system: admin, doctor, nurse, receptionist, or auditor.

## Requirements

### Requirement 1: API Client Communication

**User Story:** As a frontend developer, I want a centralized API client that handles authentication, retries, and error classification, so that all HTTP communication with the backend is consistent, reliable, and traceable.

#### Acceptance Criteria

1. WHEN the API_Client sends a request and a JWT token is available, THE API_Client SHALL attach the current JWT token as a Bearer token in the Authorization header.
2. WHEN the API_Client sends a request, THE API_Client SHALL generate a unique Correlation_ID in UUID v4 format and attach it as the X-Correlation-ID header.
3. WHEN the API_Client receives a transient failure (network error, timeout, or HTTP 5xx), THE API_Client SHALL retry the request using exponential backoff starting with a base delay of 1 second, multiplying by 2 on each subsequent attempt, with a maximum of 3 retry attempts and delays capped at a configurable maximum delay that defaults to 10 seconds.
4. IF the API_Client exhausts all retry attempts without a successful response, THEN THE API_Client SHALL propagate the last received error classified according to the error categories defined in criterion 9.
5. WHEN the API_Client receives a non-retryable error (HTTP 4xx excluding 401), THE API_Client SHALL immediately propagate the error without retrying.
6. WHEN the API_Client receives an HTTP 401 response, THE API_Client SHALL attempt a token refresh and retry the original request exactly once.
7. IF the token refresh attempt fails or the retried request after token refresh returns HTTP 401 again, THEN THE API_Client SHALL propagate an AUTHENTICATION error without further retries.
8. WHEN a request is configured with skipAuth set to true, THE API_Client SHALL omit the Authorization header from that request.
9. WHEN the API_Client classifies an error, THE API_Client SHALL categorize it into exactly one of: NETWORK (connection refused or no response received), AUTHENTICATION (HTTP 401), AUTHORIZATION (HTTP 403), VALIDATION (HTTP 400 or 422), NOT_FOUND (HTTP 404), SERVER (HTTP 5xx after retries exhausted), TIMEOUT (request exceeds the configured timeout duration of 30 seconds by default), or UNKNOWN (any error not matching the above).
10. IF no JWT token is available when the API_Client sends a request that requires authentication, THEN THE API_Client SHALL propagate an AUTHENTICATION error without sending the request to the server.

### Requirement 2: Authentication and Session Management

**User Story:** As a user, I want secure login and session management, so that my identity is verified, my session is protected from theft, and I remain authenticated across browser tabs.

#### Acceptance Criteria

1. WHEN a user submits valid credentials, THE Auth_Module SHALL authenticate the user, store the access token in memory, update the authentication state to authenticated, and navigate to the dashboard.
2. WHEN a user submits invalid credentials, THE Auth_Module SHALL display an error message indicating that the credentials are incorrect, maintain the unauthenticated state without storing any token, and not reveal whether the username or password was the incorrect field.
3. THE Auth_Module SHALL store access tokens exclusively in memory and never persist tokens to localStorage or sessionStorage, and SHALL rely on an httpOnly secure cookie for the refresh token to enable session continuity across page reloads.
4. WHEN the access token is within 5 minutes of expiration, THE Auth_Module SHALL automatically initiate a silent token refresh by calling the refresh endpoint without user interaction.
5. WHEN multiple concurrent requests trigger token refresh, THE Auth_Module SHALL execute at most one refresh request at a time, queue all other callers, and resolve all waiting callers with the single refresh response within 10 seconds or fail them all.
6. WHEN a user logs out, THE Auth_Module SHALL clear all in-memory tokens, clear user profile data, invalidate the refresh token via the backend logout endpoint, and broadcast the logout event to all browser tabs via the BroadcastChannel API.
7. WHEN a logout event is received from another browser tab, THE Auth_Module SHALL clear the local session state and redirect to the login page using replaceUrl navigation to prevent back-button access to the previous authenticated view.
8. WHEN token refresh fails, THE Auth_Module SHALL clear the authentication state and redirect the user to the login page with the attempted URL preserved as a query parameter so that the user is returned to that URL after re-authentication.
9. WHEN the application is loaded or the page is refreshed, THE Auth_Module SHALL attempt a silent token refresh using the httpOnly refresh cookie, and IF the refresh succeeds, THEN THE Auth_Module SHALL restore the authenticated state without requiring the user to log in again.
10. IF the silent token refresh on page load fails, THEN THE Auth_Module SHALL set the authentication state to unauthenticated and redirect the user to the login page with the originally requested URL preserved as a query parameter.

### Requirement 3: Role-Based Access Control

**User Story:** As a system administrator, I want role-based access control enforced at both route and UI component levels, so that users can only access resources and actions permitted by their assigned role.

#### Acceptance Criteria

1. THE RBAC_Engine SHALL define a permission matrix mapping each UserRole (admin, doctor, nurse, receptionist, auditor) to a set of permitted resource-action pairs.
2. WHEN evaluating a permission for a user with the admin role, THE RBAC_Engine SHALL return true for any resource-action combination.
3. WHEN an authenticated user navigates to a route protected by a Permission the user lacks, THE RBAC_Engine SHALL redirect the user to the /unauthorized page without modifying the browser history entry.
4. WHEN rendering a UI element wrapped in a PermissionGate component, THE RBAC_Engine SHALL hide the element if the current user lacks the required Permission, rendering no visible output or placeholder in its place.
5. WHEN a PermissionGate specifies requireAll as true with multiple permissions, THE RBAC_Engine SHALL require the user to hold all specified permissions before rendering the child element.
6. WHEN a PermissionGate specifies requireAll as false or omits it with multiple permissions, THE RBAC_Engine SHALL render the child element if the user holds at least one of the specified permissions.
7. THE RBAC_Engine SHALL treat the permission matrix as immutable at runtime by exposing only read-only data structures, so that any attempt to reassign or mutate role-permission mappings produces no change to the enforced permissions.
8. IF a PermissionGate is configured with an empty permissions array, THEN THE RBAC_Engine SHALL render the child element unconditionally.
9. WHEN an unauthenticated user navigates to any route protected by a Permission, THE RBAC_Engine SHALL redirect the user to the /login page.

### Requirement 4: State Management

**User Story:** As a frontend developer, I want a clear separation between client state and server state with appropriate tools for each, so that the application state is predictable, performant, and consistent.

#### Acceptance Criteria

1. THE State_Manager SHALL manage UI state (sidebar, theme, locale, breadcrumbs), auth state, and notification state exclusively through Redux Toolkit.
2. THE State_Manager SHALL manage all server-fetched data (patients, assessments, audit logs) exclusively through TanStack Query with a default stale time of 30 seconds, a cache garbage collection time of 5 minutes for inactive queries, and stale-while-revalidate behavior.
3. WHEN a TanStack Query cache entry becomes stale, THE State_Manager SHALL continue displaying the cached data while fetching fresh data in the background.
4. IF a background refetch fails while stale data is displayed, THEN THE State_Manager SHALL continue displaying the cached data and show a non-blocking notification indicating the refresh failed.
5. WHEN a mutation succeeds, THE State_Manager SHALL invalidate all query cache entries whose query key shares the same resource type as the mutated entity, to trigger re-fetching of updated data.
6. WHEN an optimistic mutation is rejected by the server, THE State_Manager SHALL revert the UI to the pre-mutation state and display a notification informing the user that the operation failed.
7. THE State_Manager SHALL use typed query key factories to ensure cache keys are consistent and type-safe across the application.

### Requirement 5: Error Handling and Recovery

**User Story:** As a user, I want clear error messages and graceful recovery from failures, so that I understand what went wrong and can continue using the application without losing my work.

#### Acceptance Criteria

1. WHEN an unhandled exception occurs within a Feature_Module, THE Error_Handler SHALL catch it at the nearest Error_Boundary and display a fallback UI without crashing the entire application.
2. WHEN a network error occurs, THE Error_Handler SHALL display a toast notification within 1 second indicating connection loss, and THE Error_Handler SHALL trigger automatic retry via the API_Client retry mechanism (exponential backoff, maximum 3 attempts) and display the toast for a minimum of 5 seconds or until the retry succeeds.
3. WHEN a validation error (HTTP 422) is returned, THE Error_Handler SHALL map server-provided field errors to the corresponding form fields and display inline error messages adjacent to each invalid field.
4. WHEN a server error (HTTP 5xx) occurs, THE Error_Handler SHALL display a generic error message with the Correlation_ID and provide a retry button.
5. WHEN an error is caught, THE Error_Handler SHALL report the error to the Telemetry_System with the Correlation_ID, error category, timestamp, user ID, active route path, and Feature_Module name.
6. WHEN a lazy-loaded route chunk fails to load, THE Error_Handler SHALL display a message indicating a new version is available with a reload button that triggers a full page reload.
7. THE Error_Handler SHALL classify every error into exactly one of the following ErrorCategory values: NETWORK, AUTHENTICATION, AUTHORIZATION, VALIDATION, NOT_FOUND, SERVER, TIMEOUT, or UNKNOWN before handling it, ensuring no error goes unclassified.
8. WHEN an Error_Boundary catches an error in a Feature_Module that contains a form with unsaved user input, THE Error_Handler SHALL preserve the user's form data and offer a recovery option to restore the form state after re-rendering.

### Requirement 6: Observability and Telemetry

**User Story:** As a system operator, I want structured logging, distributed tracing, and performance monitoring, so that I can troubleshoot issues, trace requests across frontend and backend, and monitor application health.

#### Acceptance Criteria

1. THE Telemetry_System SHALL initialize OpenTelemetry with W3C Trace Context propagation to the backend, enabling distributed tracing across the frontend request and backend response lifecycle.
2. WHEN the API_Client makes a request, THE Telemetry_System SHALL create a trace span recording the HTTP method, URL, duration, and response status.
3. THE Telemetry_System SHALL emit structured JSON logs where each entry includes a level (one of debug, info, warn, or error), message, ISO 8601 timestamp, Correlation_ID, userId, and the originating Feature_Module name as the feature context.
4. THE Telemetry_System SHALL track Web Vitals metrics including LCP, FID, CLS, TTFB, and INP, and export them to the configured collector endpoint.
5. WHEN a route navigation occurs, THE Telemetry_System SHALL record the navigation as a trace span with the source and destination routes.
6. WHILE the application is running in production, THE Telemetry_System SHALL batch and export logs and traces to the configured collector endpoint at intervals not exceeding 30 seconds or when the batch reaches 50 entries, whichever occurs first.
7. IF the configured collector endpoint is unreachable, THEN THE Telemetry_System SHALL buffer telemetry data in memory up to a maximum of 500 entries and retry export on the next scheduled interval, discarding the oldest entries when the buffer is full.
8. WHILE the application is running in a non-production environment, THE Telemetry_System SHALL log traces and structured logs to the browser console and SHALL NOT export telemetry data to an external collector endpoint.

### Requirement 7: Modular Feature Architecture

**User Story:** As a development team member, I want a modular architecture where each feature is a self-contained bounded context, so that teams can develop, test, and deploy features independently without coupling.

#### Acceptance Criteria

1. THE application SHALL organize code into Feature_Modules, each containing its own services, components, pages, state management, models, and route definitions within a dedicated directory under the features folder.
2. WHEN a feature route is navigated to for the first time, THE application SHALL load only that Feature_Module's code bundle via lazy loading, without downloading bundles for other features.
3. THE application SHALL ensure that shared cross-cutting code (components, hooks, utilities, types) resides in a shared directory accessible to all Feature_Modules, and that no Feature_Module imports from another Feature_Module's directory.
4. WHEN adding a new Feature_Module, THE application SHALL require no modifications to existing Feature_Modules' directories, while permitting additions to central application-level configuration files (such as the root route definitions).
5. THE application SHALL enforce that the shared directory does not import from any Feature_Module directory, ensuring a one-way dependency from Feature_Modules toward shared code.

### Requirement 8: Data Validation

**User Story:** As a user, I want immediate feedback on invalid form inputs before submission reaches the server, so that I can correct mistakes quickly and avoid unnecessary server round-trips.

#### Acceptance Criteria

1. WHEN a user submits a patient registration form, THE application SHALL validate the input against the Zod patient schema and prevent submission if validation fails.
2. WHEN form validation fails, THE application SHALL display an error message adjacent to each invalid field indicating the specific validation rule that was violated, before any network request is made.
3. THE application SHALL validate that patient firstName and lastName are non-empty strings with a maximum length of 100 characters each.
4. THE application SHALL validate that patient contactNumber matches the pattern for valid phone numbers (7-15 digits, optional leading "+" country code prefix, allowing digits, spaces, and hyphens only).
5. THE application SHALL validate that patient email, when provided, conforms to a valid email format (local-part@domain with at least one dot in the domain).
6. THE application SHALL validate that patient dateOfBirth is a valid date string in ISO 8601 format (YYYY-MM-DD) and is not a future date.
7. WHEN creating an assessment, THE application SHALL validate that the formData conforms to the template schema associated with the selected disease, verifying all required fields are populated and all field values satisfy the validation rules (min, max, minLength, maxLength, pattern) defined in the template.
8. IF assessment template validation fails, THEN THE application SHALL display error messages adjacent to each invalid field in the dynamic form and prevent submission until all validation errors are resolved.

### Requirement 9: Security

**User Story:** As a security officer, I want the application to implement defense-in-depth security measures, so that patient medical data is protected against common web vulnerabilities.

#### Acceptance Criteria

1. THE application SHALL configure Content Security Policy headers via nginx restricting scripts to self-origin only.
2. THE application SHALL sanitize any user-generated HTML content using DOMPurify before rendering it in the DOM.
3. THE application SHALL never include patient PII (defined as: patient name, date of birth, contact number, email, and medical record content) in URL parameters or browser history entries.
4. WHEN no user interaction (mouse movement, keyboard input, or touch event) has occurred for 15 minutes, THE Auth_Module SHALL clear the session, redirect to the login page, and preserve the current URL as the return path.
5. THE application SHALL enforce locked lockfile installation via npm ci in CI pipelines.
6. IF npm audit detects vulnerabilities at severity level "critical" or "high", THEN THE CI pipeline SHALL block deployment and report the failing packages.
7. THE application SHALL set security headers including X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, and Referrer-Policy strict-origin-when-cross-origin via nginx.

### Requirement 10: Performance

**User Story:** As a user, I want the application to load quickly and remain responsive during use, so that I can efficiently manage patient records without waiting.

#### Acceptance Criteria

1. THE application SHALL achieve an initial page load bundle size of less than 200KB gzipped.
2. THE application SHALL achieve a Largest Contentful Paint (LCP) of less than 2.5 seconds when measured on a simulated fast 4G connection (1.6 Mbps download, 150ms RTT) with 4x CPU throttling.
3. THE application SHALL achieve a Cumulative Layout Shift (CLS) of less than 0.1 throughout the page lifecycle.
4. WHEN navigating between features, THE application SHALL load feature bundles independently, each under 100KB gzipped.
5. WHEN rendering data tables exceeding 1000 rows, THE application SHALL use virtual scrolling and maintain a frame rate of at least 30fps during scrolling with no individual frame duration exceeding 50ms.
6. THE application SHALL separate vendor libraries, UI framework, and state management libraries into distinct chunks with content-hash-based filenames so that unchanged chunks remain cached across deployments.
7. WHEN a user interacts with any UI control (button click, form input, navigation), THE application SHALL respond with a visible update within 200ms under normal operating conditions.

### Requirement 11: Deployment and Infrastructure

**User Story:** As a DevOps engineer, I want containerized deployment with health checks and automated CI/CD pipelines, so that the application can be reliably built, tested, and deployed across environments.

#### Acceptance Criteria

1. THE application SHALL provide a multi-stage Dockerfile that builds the application and serves it via an Alpine-based nginx image, with the final production image size not exceeding 150MB uncompressed.
2. THE application SHALL expose a /health endpoint that returns HTTP 200 with a JSON response body containing at minimum a "status" field set to "ok", responding within 5 seconds for container orchestration health checks.
3. WHEN a code change is pushed, THE CI pipeline SHALL run linting, type checking, unit tests, and dependency vulnerability scanning in sequence, and SHALL block the merge if any step produces a failure exit code.
4. THE CI pipeline SHALL enforce a minimum of 80% code coverage for Feature_Modules and shared utility modules, and SHALL block merges that fall below this threshold.
5. THE application SHALL support environment-specific configuration via VITE_API_URL (a valid URL string) and VITE_ENV (one of "development", "staging", or "production") build-time environment variables.
6. THE nginx configuration SHALL enable gzip compression at a minimum compression level of 6 for text/plain, text/css, application/json, and application/javascript content types.
7. THE nginx configuration SHALL set Cache-Control headers with "public, max-age=31536000, immutable" for static assets with hashed filenames (JS, CSS, images, fonts).
8. IF the /health endpoint detects that the nginx process is not serving requests, THEN THE application SHALL return HTTP 503 with a JSON response body containing a "status" field set to "unavailable".

### Requirement 12: Internationalization

**User Story:** As a user in a multilingual environment, I want the application to support multiple languages, so that I can use the system in my preferred language.

#### Acceptance Criteria

1. THE application SHALL support English (en) and French (fr) as user-selectable interface languages, with English as the default language displayed on first visit or when no preference has been stored.
2. WHEN a user selects a language, THE application SHALL load translation files for that language, re-render all visible static UI text in the selected language, and persist the selection so that subsequent page loads use the same language without requiring re-selection.
3. THE application SHALL organize translation files by feature namespace, enabling code-split loading of translations alongside their Feature_Module.
4. THE application SHALL format dates and numbers according to the user's selected locale (en-US for English, fr-FR for French) using the Intl API.
5. IF a translation key is missing from the active language file, THEN THE application SHALL fall back to the English translation for that key and render the English text rather than displaying a raw key identifier.
6. WHEN a user selects a language and the translation file for that language fails to load, THE application SHALL retain the current language, display an error notification indicating the language change failed, and allow the user to retry.
