# DispatchV2.1 - Core Architectural Frameworks & Policies

This document outlines the reusable modules, security policies, and architectural patterns implemented in this project. These frameworks are designed to be "project-agnostic" and are optimized for an enterprise Django + Angular application.

---

## 1. Multi-Tier Administrative Framework
The project implements a 3-tier role-based access control (RBAC) system:

### **Super Admin Module**
*   **Purpose:** Global system governance and user provisioning.
*   **Capabilities:** 
    *   Full CRUD on system users.
    *   Global system toggles (e.g., enabling/disabling SSO for the entire organization).
    *   Direct database schema management and master profile activation.
*   **Reusable Policy:** The `superAdminMiddleware` ensures that sensitive configuration routes are physically isolated from standard administrative tasks.

### **Admin Module**
*   **Purpose:** Operational data management (Master Data).
*   **Capabilities:** 
    *   Managing business-logic tables (Couriers, Charges, Divisions).
    *   Access to operational logs and reporting.
*   **Reusable Policy:** Use of `authMiddleware` combined with specific role checks to allow operational managers to maintain data without system-level risk.

---

## 2. Enterprise Authentication & SSO Policy
A "Hybrid Auth" strategy that allows both standard and enterprise login.

### **Microsoft SSO Integration (MSAL)**
*   **Framework:** Integration with Microsoft Entra ID via Python `msal` and Angular `@azure/msal-angular`.
*   **Policy:** 
    *   **Strict Provisioning:** New users must be created in the Django database by a Super Admin before SSO login is permitted.
    *   **Per-User Toggle:** Individual control to allow/deny SSO login for specific users, providing a fallback to standard credentials if needed.
    *   **Backend Verification:** Every SSO token is cryptographically verified on the Django backend using OpenID Connect standards.

---

## 3. User Lifecycle Management Policy
Moving beyond simple "Delete" functionality to enterprise-grade state management.

### **Soft-State Control (Active/Inactive)**
*   **Framework:** Users are never truly deleted from the system to maintain audit trails and data integrity (PostgreSQL foreign key constraints).
*   **Implementation:** An `is_active` boolean flag is checked during every login attempt and middleware handshake.
*   **Benefit:** Prevents orphan records in transaction tables while instantly revoking access.

---

## 4. Bulk Master Data Framework
A standardized approach to high-volume data ingestion.

### **Excel-to-DB Engine**
*   **Framework:** Leveraging `xlsx` (Frontend) and Django's `bulk_create` / `update_or_create` logic.
*   **Policy:**
    *   **Conflict Resolution:** Uses Django's `update_or_create` to handle duplicates gracefully.
    *   **Validation:** Every row is validated by Django Rest Framework (DRF) serializers before database insertion.
*   **Reusable Component:** The Excel upload pattern used for `Charges Master` can be applied to any tabular data (Employees, Products, Inventory).

---

## 5. Security & Validation Framework
Standardized layers of protection applied to every API endpoint.

### **DRF Serializer Validation**
*   **Policy:** No request enters the business logic without passing strict DRF Serializer field validation.
*   **Framework:** Centralized serializers used for both CRUD and reporting, ensuring data integrity.

### **JWT Strategy**
*   **Policy:** Short-lived access tokens (SimpleJWT) with HMAC-SHA256 signing for stateless authentication.

---

## 6. High-Performance Reporting Framework
Optimized for handling "Lakhs of Data" without crashing the browser.

### **Virtual Scrolling (CDK)**
*   **Implementation:** Only rendering the visible subset of records (approx. 20-30 rows) regardless of whether the dataset contains 100 or 100,000 records.
*   **Policy:** API-side pagination (`LIMIT` / `OFFSET`) is mandatory for all reporting endpoints to keep memory overhead low.

### **Generic Export Engine**
*   **Excel:** Client-side generation using `XLSX` to offload processing from the server.
*   **PDF:** Structured document generation using `jspdf-autotable` with safe-parsing for dates and null values.

---

## 7. Centralized Observability & Error Handling
### **Django Logging Framework**
*   **Policy:** Every request and internal error is logged via Django's integrated logging system.
*   **Implementation:** Errors are categorized into console and file logs, including database query profiles during debugging.

### **Unified DRF Error Responses**
*   **Framework:** Standardized DRF Exceptions that ensure the API always returns a consistent JSON structure for both validation and system errors.

---

## 8. Dev-Ops & Containerization
### **Docker Policy**
*   **Strategy:** Multi-stage builds for both Frontend (Nginx) and Backend (Django + Gunicorn).
*   **Implementation:** Use of persistent Docker volumes for the `uploads/` directory to ensure document continuity in ephemeral container environments.

---

## 9. Global Styling & Theming Framework
### **Project-Agnostic Design System**
*   **CSS Variable Abstraction:** All global styles must be anchored to standardized CSS variables defined natively in the root styling file (e.g., src/styles.css). This acts as the project's design token registry.
*   **Transportable Component Styling:** Common UI components (forms, tables, cards, modal dialogs) should not contain hardcoded formatting. They must dynamically reference design tokens (like var(--primary-color), var(--bg-light), var(--text-main)). This enables identical HTML/CSS combinations to be ported between projects; they instantly adapt to the new project's color palette merely by altering the root file.
*   **Typography Standardization:** Enforce a clean, functional web font (such as Inter or system fonts) globally at the body level to maintain consistent, enterprise-grade layouts across all implementations.

---

## 10. Standardized Asset Injection (Branding & Logo)
### **The "Drop-in" Branding Strategy**
To maintain a reusable application shell, branding assets are strictly decoupled from the component templates.
*   **Generic Templating:** UI elements (like the Navbar or Header) should reference static, fixed filenames natively (e.g., <img src="logo.jpeg" />). 
*   **Bootstrapping New Projects:** To initialize immediate branding for a new deployment, simply copy the base logo.jpeg found in the central Docs/ directory into the active project's public/ (or equivalent assets) folder. Because the template mappings are generic, the UI organically picks up the logo, completely eliminating the need to search for or alter HTML image attributes.

---

## 11. Scalable & Agnostic Navigation Architecture
### **The Native Sidebar Pattern**
The navigation menu provides an architectural blueprint that scales equally well for logistics, healthcare, or financial dashboard projects:
*   **Component Isolation:** Built entirely natively as an independent component using native Flexbox grids and lightweight inline SVGs. This sidesteps the bloated performance overhead and rigid styling of common third-party UI libraries.
*   **Performant Reactivity:** Internal state changes (e.g., expanding grouped items or collapsing the main panel) must leverage modern atomic state management frameworks (such as native Angular Signals, e.g., isCollapsed()). This keeps logic flat and UI rendering lightning fast.
*   **Role-Based Dynamic Templates (RBAC):** Integrate security directly into the rendering lifecycle. Ensure that navigational links are actively guarded based on the user's role via an injected global AuthService. Using view-layer conditionals (e.g., @if (auth.hasRole('admin'))), the UI perfectly controls access without sending inaccessible DOM nodes to the browser.

---

## 12. Client-Side Security & Navigation Integrity
### **Functional Route Guards**
*   **Strategy:** Protect every internal route using functional "Gatekeepers" (`canActivate`).
*   **Policy:** 
    *   **authGuard:** Redirects unauthenticated users to `/login`.
    *   **adminGuard & superAdminGuard:** Enforces strict role-based isolation (e.g., Admin for Master Data, Super Admin for User Management).
    *   **guestGuard:** Prevents unnecessary access to the login page for already authenticated users.

### **History Stack Hygiene**
*   **Policy:** Use `replaceUrl: true` during logout and sensitive redirects.
*   **Purpose:** Overwrites the current browser history state to prevent the "Back" button from re-exposing cached dashboard views after a session is cleared. 
*   **Benefit:** Native browser protection against "Session After Logout" vulnerabilities without complex window-event listeners.

