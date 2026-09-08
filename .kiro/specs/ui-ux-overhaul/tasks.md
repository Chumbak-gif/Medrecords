# Implementation Plan: UI/UX Overhaul

## Overview

Comprehensive implementation plan to transform the MEDRecords Angular 17 application from its current red-branded Emcure Design System to a healthcare-focused blue/teal token-driven architecture with dark/light mode, custom PrimeNG theme, WCAG 2.1 AA accessibility, and consistent shared components across all 13 feature pages.

## Tasks

- [ ] 1. Design Token Foundation
  - [x] 1.1 Define CSS custom properties in `styles.css` `:root` block
    - Define brand color tokens (primary-50 through primary-900) using healthcare blue/teal palette (hue 189°)
    - Define secondary/accent color token
    - Define neutral scale tokens (neutral-0 through neutral-900)
    - Define semantic color tokens (success, warning, error, info) with base, light-bg, and dark-text variants
    - Define surface tokens (background, card, elevated, overlay)
    - Define spacing tokens (space-1 through space-16) on 4px base unit
    - Define typography tokens (font-family, font sizes xs through 2xl, line-heights, font-weights)
    - Define border-radius tokens (sm: 4px, md: 8px, lg: 12px, xl: 16px, full: 9999px)
    - Define elevation/shadow tokens (sm, md, lg)
    - Define motion tokens (duration-fast: 150ms, duration-normal: 250ms, duration-slow: 400ms, ease-out, ease-spring)
    - Organize using `@layer base` for token declarations
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 4.1, 4.2, 4.3, 4.5, 5.1, 5.2, 5.3, 5.4, 6.1_

  - [-] 1.2 Define dark mode token overrides in `[data-theme="dark"]` selector
    - Override surface tokens with dark neutrals (lightness < 20%)
    - Override neutral scale (inverted for dark backgrounds)
    - Adjust brand primary color for dark mode contrast (lighter cyan #22d3ee)
    - Ensure all text-on-background pairs maintain WCAG AA contrast ratios
    - Override semantic color variants for dark backgrounds
    - _Requirements: 3.2, 3.7, 4.4_

  - [ ]* 1.3 Write property tests for design token invariants
    - **Property 1: Spacing tokens follow 4px base unit**
    - **Property 2: Primary color hue within healthcare range (180–210°)**
    - **Property 10: Semantic colors have complete variant sets**
    - **Validates: Requirements 1.2, 1.3, 4.1, 4.3, 6.1**

  - [ ]* 1.4 Write property test for dark mode surface lightness
    - **Property 6: Dark mode surface lightness constraint**
    - **Validates: Requirements 3.2**

  - [ ]* 1.5 Write property test for WCAG AA contrast ratio compliance
    - **Property 9: WCAG AA contrast ratio compliance**
    - Validate all defined text-on-background pairs in both light and dark modes
    - **Validates: Requirements 3.7, 4.4, 12.4, 14.1**

- [ ] 2. Tailwind CSS Configuration
  - [-] 2.1 Update `tailwind.config.js` to consume design tokens
    - Map colors (primary, neutral, semantic, surface) to CSS custom properties
    - Map spacing scale to token variables
    - Map border-radius values to tokens
    - Map box-shadow values to tokens
    - Configure font-family with Poppins + system-ui fallback
    - Map transition-duration values to tokens
    - Set content paths for Angular HTML and TS files
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 1.7, 5.1_

  - [~] 2.2 Configure Tailwind CSS layers in `styles.css`
    - Organize styles using `@layer base`, `@layer components`, `@layer utilities`
    - Add global base styles: body text 14px/1.5, antialiased font rendering
    - Add `prefers-reduced-motion` media query to disable animations
    - Add global `:focus-visible` styles (2px solid primary, 2px offset)
    - Suppress focus ring for mouse clicks with `:focus:not(:focus-visible)`
    - _Requirements: 5.5, 5.6, 14.2, 15.5, 17.3_

- [ ] 3. PrimeNG Custom Theme
  - [~] 3.1 Create `styles/primeng-theme.css` with token-based PrimeNG overrides
    - Style `p-datatable` (thead, tbody, cells) using `:root` specificity — no `!important`
    - Style `p-dialog` (border-radius, shadow, overlay) consuming tokens
    - Style form controls (`p-inputtext`, `p-dropdown`, `p-multiselect`, `p-calendar`) with consistent height, border, focus ring
    - Style `p-paginator` with brand primary active indicator
    - Style dropdown/multiselect overlay panels with token-based backgrounds, borders, shadows
    - Include dark mode overrides via `[data-theme="dark"]` selectors
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 3.2 Write property tests for PrimeNG theme token compliance
    - **Property 4: PrimeNG theme consumes design tokens exclusively**
    - **Property 5: Zero !important declarations in theme stylesheet**
    - **Validates: Requirements 2.1, 2.6, 15.1**

- [ ] 4. Theme Engine (Dark/Light Mode Service)
  - [~] 4.1 Create `ThemeService` at `frontend/src/app/core/theme/theme.service.ts`
    - Implement as `@Injectable({ providedIn: 'root' })`
    - Use Angular `signal<'light' | 'dark'>` for reactive mode state
    - Implement `toggle()` method: flip mode, apply `data-theme` attribute on `<html>`, persist to localStorage
    - Implement `loadPreference()`: read from localStorage, default to 'light' if absent or corrupted
    - Apply theme on service construction (initial load)
    - Handle localStorage unavailable gracefully (private browsing fallback)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 4.2 Write property tests for theme mode round-trip
    - **Property 7: Theme mode round-trip preservation**
    - **Property 8: Theme preference localStorage persistence round-trip**
    - **Validates: Requirements 3.3, 3.4**

  - [ ]* 4.3 Write unit tests for ThemeService edge cases
    - Test: defaults to light when localStorage is empty
    - Test: defaults to light when localStorage has corrupted value
    - Test: applies `data-theme="dark"` attribute when toggled to dark
    - Test: persists preference across service re-instantiation
    - _Requirements: 3.4, 3.5_

- [~] 5. Checkpoint — Token foundation and theme engine verified
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Shared Component Refactoring — App Shell
  - [~] 6.1 Refactor `app-shell` component
    - Add skip-navigation link (`<a class="skip-link" href="#main-content">Skip to main content</a>`)
    - Implement flex layout: sidebar + main area side by side
    - Set `max-width: 1600px` on main content area
    - Add `role="main"` and `id="main-content"` on `<main>` element
    - Use design tokens for all spacing, colors, transitions
    - Support sidebar collapsed/expanded signal state
    - _Requirements: 6.2, 6.4, 6.5, 14.6, 18.1, 18.5_

  - [~] 6.2 Refactor `sidebar` component
    - Set width: 240px expanded, 64px collapsed with smooth transition (duration-normal)
    - Implement nav items with icon (20px), label (14px, medium weight), active indicator (left border + primary bg)
    - Add section headings: uppercase, 11px, letter-spacing 0.12em, neutral-500
    - Implement hover state: primary-50 background within 150ms
    - Collapsed state: icons only with tooltip labels on hover
    - Add `<nav aria-label="Primary navigation">` wrapper
    - Add `:focus-visible` outline on all nav links
    - Use only CSS custom properties for all visual values
    - _Requirements: 6.2, 11.1, 11.2, 11.3, 11.5, 11.6, 14.3, 17.4_

  - [~] 6.3 Refactor `topbar` component
    - Set fixed height 56px, pinned to top
    - Add theme mode toggle button with ThemeService injection
    - Add notification indicator button
    - Add user avatar/menu area
    - Add brand logo/mark
    - Add `role="banner"` on `<header>` element
    - Add descriptive `aria-label` attributes on all buttons
    - Use design tokens for all styling
    - _Requirements: 3.1, 6.3, 11.4, 14.4, 14.5_

- [ ] 7. Shared Component Refactoring — UI Components
  - [~] 7.1 Refactor `kpi-card` component
    - Implement with surface-card background, radius-lg, shadow-sm, 1px border neutral-200
    - Add icon container, metric value (text-xl, bold), label (text-sm, neutral-600)
    - Add hover effect: border-color primary, shadow-md, translateY(-2px)
    - Mark icon with `aria-hidden="true"`
    - Use design tokens exclusively
    - _Requirements: 9.2, 14.5, 17.1_

  - [~] 7.2 Refactor `status-badge` component
    - Implement unified badge: inline-flex, radius-full, 3px/10px padding, 11px, weight 600, uppercase
    - Define color map: active, approved, pending, rejected, draft, inactive, error, success, warning, info
    - Use CSS variable binding for dynamic bg/text colors from semantic tokens
    - Add `role="status"` attribute
    - Ensure contrast ratio ≥ 4.5:1 in both light and dark modes
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 14.4_

  - [ ]* 7.3 Write property tests for badge structural invariant
    - **Property 13: Badge structural invariant**
    - **Property 14: Unified badge component usage across pages**
    - **Validates: Requirements 12.1, 12.3**

- [ ] 8. Global Button and Form Control Styling
  - [~] 8.1 Define button utility classes in global styles
    - Define variants: primary (filled, brand), secondary (outlined), danger (filled, error), ghost (text-only)
    - Define sizes: sm (32px/12px), md (40px/14px), lg (48px/16px)
    - Apply radius-full (pill shape) to all buttons
    - Add hover state: color shift + subtle elevation within 150ms
    - Add focus-visible: 2px ring, 2px offset, brand primary color
    - Add disabled state: opacity 0.5, cursor not-allowed, suppress hover/active
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 17.1_

  - [~] 8.2 Define form control styling in global styles
    - Set minimum height 40px, border-radius radius-md (8px), border 1.5px, font-size 14px
    - Add focus state: brand primary border + 3px spread ring
    - Add error state: semantic error border + error message color
    - Add disabled state: neutral-100 background, reduced text opacity
    - Style labels: 12px, weight 600, neutral-600, positioned above inputs
    - Ensure HTML `for`/`id` attribute pairing pattern documented
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 8.3 Write property tests for button and form accessibility
    - **Property 11: Button pill-shape invariant**
    - **Property 12: Form label-input accessibility pairing**
    - **Property 15: Focus indicator visibility on interactive elements**
    - **Validates: Requirements 7.4, 7.6, 8.6, 14.2, 14.7**

- [ ] 9. Card and Table Styling
  - [~] 9.1 Define card container styles
    - Base card: surface-card background, radius-lg, 1px border neutral-200, shadow-sm, token padding
    - Page header card: flexbox space-between, consistent vertical padding, bottom margin spacing-5
    - Eliminate conflicting shadow/border declarations across feature pages
    - _Requirements: 9.1, 9.3, 9.4_

  - [~] 9.2 Define data table styles
    - Headers: 12px, weight 700, uppercase, letter-spacing, neutral-600 text, neutral-50 background
    - Cells: 12px vertical / 16px horizontal padding
    - Row hover: neutral-50 background highlight
    - Row borders: 1px solid neutral-200
    - Sort indicators: brand-primary color when active
    - Empty state: centered message/illustration
    - Horizontal scroll when content exceeds width
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 18.4_

- [ ] 10. Dialog and Modal Styling
  - [~] 10.1 Define dialog styles
    - Border-radius radius-lg (12px), header with title + close button, scrollable content, footer with actions
    - Backdrop overlay at 45% opacity dark
    - Header: padding 20px 24px, weight 700, border-bottom neutral-200
    - Footer: background neutral-50, border-top neutral-200, right-aligned buttons with 10px gap
    - Entry animation: duration-normal (250ms) with subtle scale/translate
    - Ensure PrimeNG `p-dialog` has `aria-labelledby` pointing to title
    - Add `aria-describedby` when description present
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 14.4, 17.2_

- [~] 11. Checkpoint — Shared components and global styles verified
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Accessibility Layer
  - [~] 12.1 Implement ARIA landmarks and attributes across shared components
    - Sidebar: `<nav aria-label="Primary navigation">`
    - Topbar: `<header role="banner">`
    - Main content: `<main id="main-content" role="main">`
    - Dialogs: verify `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
    - Status badges: `role="status"`
    - Form errors: `aria-live="polite"`, linked via `aria-describedby`
    - All icons: `aria-hidden="true"` on decorative, `aria-label` on functional
    - _Requirements: 14.3, 14.4, 14.5, 14.7_

  - [~] 12.2 Implement keyboard navigation support
    - Verify full tab navigation: sidebar → topbar → content → dialogs
    - Dialog focus trap (PrimeNG built-in, verify correct behavior)
    - Dialog Escape key closes dialog (PrimeNG built-in, verify)
    - Table sort via keyboard (Enter/Space on sortable headers)
    - Dropdown/multiselect keyboard operation
    - _Requirements: 14.3, 13.3, 13.4_

  - [ ]* 12.3 Write property tests for accessibility invariants
    - **Property 16: ARIA attributes on custom components**
    - **Property 17: Image and icon accessibility**
    - **Validates: Requirements 14.4, 14.5**

- [ ] 13. Feature Page Standardization
  - [~] 13.1 Standardize analytics-admin and analytics-pharma pages
    - Apply consistent page header card with title (18px, bold) and right-aligned action buttons
    - Use shared KPI card component for dashboard metrics
    - Apply standardized table styling for data lists
    - Use design tokens for all visual values — remove any hardcoded values
    - Apply consistent padding from app shell (24px)
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 18.2, 18.3_

  - [~] 13.2 Standardize assessments and audit-log pages
    - Apply page header card pattern
    - Apply standardized data table with pagination, row density, empty state
    - Use shared status-badge component for status indicators
    - Remove any page-specific inline badge styling
    - Use design tokens exclusively
    - _Requirements: 16.1, 16.4, 16.5, 12.3_

  - [~] 13.3 Standardize auth and system-config pages
    - Apply standardized form layout: label placement, 16px field spacing, validation messaging
    - Apply card container styling
    - Use design tokens exclusively
    - _Requirements: 16.1, 16.4, 16.6_

  - [~] 13.4 Standardize diseases, medicines, and templates pages
    - Apply page header card with action buttons
    - Apply standardized data table styling
    - Apply shared status-badge component
    - Apply standardized form dialogs for create/edit
    - Use design tokens exclusively
    - _Requirements: 16.1, 16.4, 16.5, 16.6, 12.3_

  - [~] 13.5 Standardize doctor-dashboard and doctors pages
    - Apply KPI cards grid (responsive: up to 4 per row at ≥1440px)
    - Apply page header card
    - Apply standardized table and card styling
    - Use design tokens exclusively
    - _Requirements: 16.1, 16.4, 18.2, 18.3_

  - [~] 13.6 Standardize patients and followup-calendar pages
    - Apply page header card with action buttons
    - Apply standardized data table with pagination and empty state
    - Apply shared status-badge for patient status indicators
    - Apply standardized form dialogs (followup-dialog)
    - Use design tokens exclusively
    - _Requirements: 16.1, 16.4, 16.5, 16.6, 12.3_

  - [ ]* 13.7 Write property test for page layout consistency
    - **Property 18: Page layout structural consistency**
    - **Validates: Requirements 16.1, 16.2, 16.3**

- [ ] 14. CSS Cleanup and Code Quality
  - [~] 14.1 Remove hardcoded values and dead CSS
    - Audit all component CSS files — replace hardcoded hex colors with token references
    - Remove all `!important` declarations from global and component styles
    - Remove all inline `style` attributes from component templates
    - Remove unused CSS classes, duplicate rules, and dead selectors
    - Ensure all component-specific styles use Angular ViewEncapsulation.Emulated
    - _Requirements: 1.8, 15.1, 15.2, 15.3, 15.4, 15.6_

  - [ ]* 14.2 Write property tests for CSS code quality
    - **Property 3: No hardcoded visual values in component styles**
    - **Property 19: Transition duration token compliance**
    - **Property 20: Reduced motion preference respect**
    - **Validates: Requirements 1.8, 15.2, 15.4, 17.1, 17.3**

- [~] 15. Final Checkpoint — Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate the 20 correctness properties defined in the design document
- The PrimeNG theme uses `:root` specificity rather than `!important` — this is a key architectural decision
- All 13 feature pages must use shared components (status-badge, kpi-card) rather than local implementations
- The ThemeService uses Angular signals for reactive state, ensuring all components re-render on mode change without page reload
- TypeScript/Angular is the implementation language for all tasks

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3", "1.4", "1.5", "2.2", "3.1"] },
    { "id": 3, "tasks": ["3.2", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "6.1", "6.2", "6.3"] },
    { "id": 5, "tasks": ["7.1", "7.2", "8.1", "8.2"] },
    { "id": 6, "tasks": ["7.3", "8.3", "9.1", "9.2", "10.1"] },
    { "id": 7, "tasks": ["12.1", "12.2"] },
    { "id": 8, "tasks": ["12.3", "13.1", "13.2", "13.3"] },
    { "id": 9, "tasks": ["13.4", "13.5", "13.6"] },
    { "id": 10, "tasks": ["13.7", "14.1"] },
    { "id": 11, "tasks": ["14.2"] }
  ]
}
```
