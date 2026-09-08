# Requirements Document

## Introduction

Comprehensive UI/UX overhaul of the MEDRecords Angular application. The project replaces the existing red-branded Emcure Design System with a healthcare-focused blue/teal palette, introduces a unified design token architecture, builds a custom PrimeNG theme, adds dark/light mode support, achieves WCAG 2.1 AA accessibility compliance, and standardizes all 13 feature pages plus shared components for a clean, modern, professional medical SaaS experience optimized for desktop.

## Glossary

- **Design_System**: The unified set of CSS custom properties (design tokens), Tailwind configuration, PrimeNG theme, and component styles that govern the visual appearance of the MEDRecords application
- **Application**: The MEDRecords Angular 17 frontend application including all feature modules and shared components
- **Theme_Engine**: The subsystem responsible for switching between light and dark color modes and persisting user preference
- **Color_Token**: A CSS custom property defining a single color value consumed by components, organized in semantic layers (brand, neutral, semantic, surface)
- **PrimeNG_Theme**: The custom theme configuration applied to all PrimeNG components (tables, dialogs, dropdowns, calendars, multiselects, paginators) within the Application
- **Sidebar**: The primary navigation component rendered on the left side of the application shell
- **Topbar**: The horizontal header component containing branding, search, notifications, user menu, and theme toggle
- **Feature_Page**: Any of the 13 route-level pages: analytics-admin, analytics-pharma, assessments, audit-log, auth, diseases, doctor-dashboard, doctors, followup-calendar, medicines, patients, system-config, templates
- **Shared_Component**: Any reusable component in the shared directory: app-shell, dynamic-form, followup-dialog, kpi-card, prescription-grid, sidebar, status-badge, topbar
- **Focus_Indicator**: A visible outline or ring rendered around interactive elements when they receive keyboard focus
- **Contrast_Ratio**: The relative luminance ratio between foreground text and its background as defined by WCAG 2.1 guidelines
- **Desktop_Viewport**: A browser viewport width of 1024 pixels or greater

## Requirements

### Requirement 1: Design Token Architecture

**User Story:** As a developer, I want a single source of truth for all visual design values, so that styling is consistent and maintainable across the entire application.

#### Acceptance Criteria

1. THE Design_System SHALL define Color_Tokens organized into four layers: brand (primary, secondary), neutral (0–900 scale), semantic (success, warning, error, info), and surface (background, card, elevated, overlay)
2. THE Design_System SHALL use a healthcare blue/teal hue (primary hue range 180–210 on the HSL wheel) as the brand primary color replacing the existing red (#ed1c24)
3. THE Design_System SHALL define spacing tokens using a consistent 4-pixel base unit scale (4, 8, 12, 16, 20, 24, 32, 40, 48, 64 pixels)
4. THE Design_System SHALL define typography tokens for font-family, font-size (minimum 5 size steps), font-weight, and line-height
5. THE Design_System SHALL define border-radius tokens at small (4px), medium (8px), large (12px), extra-large (16px), and full (9999px) values
6. THE Design_System SHALL define elevation tokens (shadow) at 3 levels: sm, md, and lg
7. THE Design_System SHALL define motion tokens for duration (fast, normal, slow) and easing (ease-out, ease-spring)
8. WHEN the Design_System is compiled, THE Application SHALL contain zero hardcoded color hex values in component-level CSS or inline styles

### Requirement 2: Custom PrimeNG Theme

**User Story:** As a developer, I want PrimeNG components to integrate seamlessly with the design system, so that there is no visual disconnect between custom and library components.

#### Acceptance Criteria

1. THE PrimeNG_Theme SHALL consume Color_Tokens from the Design_System for all color properties (background, border, text, hover, active, focus states)
2. THE PrimeNG_Theme SHALL style table components (p-table) with consistent header backgrounds, row hover states, cell padding matching the spacing token scale, and sort indicator colors derived from the brand palette
3. THE PrimeNG_Theme SHALL style dialog components (p-dialog) with rounded corners matching the radius-lg token, consistent header/content/footer padding, and overlay backgrounds using the surface overlay token
4. THE PrimeNG_Theme SHALL style form controls (p-inputtext, p-dropdown, p-multiselect, p-calendar) with consistent height (40px minimum), border width, border radius, focus ring color derived from the primary Color_Token, and font properties from typography tokens
5. THE PrimeNG_Theme SHALL style paginator components with consistent padding, button sizing, and active-page indicator using the brand primary Color_Token
6. THE PrimeNG_Theme SHALL eliminate all use of CSS !important declarations for PrimeNG component styling by using proper specificity through theme configuration or encapsulation
7. WHEN the user interacts with a PrimeNG dropdown or multiselect, THE PrimeNG_Theme SHALL render the overlay panel with background, border, shadow, and item hover states derived from the Design_System tokens

### Requirement 3: Dark/Light Mode

**User Story:** As a user, I want to switch between dark and light modes, so that I can reduce eye strain during long usage sessions and match my system preference.

#### Acceptance Criteria

1. THE Theme_Engine SHALL provide a toggle control in the Topbar that switches between light mode and dark mode
2. WHEN the user activates the dark mode toggle, THE Theme_Engine SHALL apply a dark color palette where surface backgrounds use dark neutrals (lightness below 20%), text uses light neutrals (lightness above 80%), and brand colors adjust for adequate contrast
3. WHEN the user activates the light mode toggle, THE Theme_Engine SHALL apply the default light color palette
4. THE Theme_Engine SHALL persist the user's mode preference in browser localStorage
5. WHEN the Application loads and no stored preference exists, THE Theme_Engine SHALL default to the light mode
6. WHEN the mode changes, THE Application SHALL re-render all components, PrimeNG overlays, the Sidebar, and the Topbar using the active mode palette without requiring a page reload
7. WHILE dark mode is active, THE Design_System SHALL maintain a Contrast_Ratio of 4.5:1 or greater for normal text and 3:1 or greater for large text (18px or 14px bold) against their backgrounds

### Requirement 4: Color Palette and Brand Identity

**User Story:** As a product owner, I want the application to convey a calm, professional, clinical aesthetic, so that users trust the platform for managing medical records.

#### Acceptance Criteria

1. THE Design_System SHALL define a primary palette with a base hue in the blue/teal range (approximately #0891b2 to #0d9488 spectrum), plus lighter tints (50, 100, 200) and darker shades (700, 800, 900)
2. THE Design_System SHALL define a secondary/accent color that complements the primary palette for highlights and interactive affordances
3. THE Design_System SHALL define semantic colors: success (green family), warning (amber family), error (red family), and info (blue family) each with base, light-background, and dark-text variants
4. THE Design_System SHALL ensure all color pairings used for text-on-background meet WCAG 2.1 AA Contrast_Ratio requirements (4.5:1 for normal text, 3:1 for large text)
5. THE Design_System SHALL define neutral colors in a 10-step scale (0 through 900) for backgrounds, borders, disabled states, and secondary text

### Requirement 5: Typography System

**User Story:** As a user, I want clear, readable text at every level of the interface, so that I can efficiently scan and comprehend medical data.

#### Acceptance Criteria

1. THE Design_System SHALL use the Poppins font family as the primary typeface with a system-ui fallback stack
2. THE Design_System SHALL define a type scale with minimum sizes: xs (11px), sm (12px), base (14px), md (16px), lg (18px), xl (20px), 2xl (24px)
3. THE Design_System SHALL define line-height tokens: tight (1.25), normal (1.5), relaxed (1.75)
4. THE Design_System SHALL define font-weight tokens: light (300), regular (400), medium (500), semibold (600), bold (700)
5. THE Application SHALL render body text at 14px with a line-height of 1.5 as the default
6. THE Application SHALL render all text with -webkit-font-smoothing set to antialiased for consistent cross-browser rendering

### Requirement 6: Spacing and Layout System

**User Story:** As a user, I want consistent spacing and alignment throughout the application, so that the interface feels organized and easy to navigate.

#### Acceptance Criteria

1. THE Design_System SHALL define a spacing scale based on a 4px unit: 1 (4px), 2 (8px), 3 (12px), 4 (16px), 5 (20px), 6 (24px), 8 (32px), 10 (40px), 12 (48px), 16 (64px)
2. THE Application SHALL use the Sidebar at a fixed width of 240px (expanded) and 64px (collapsed) with smooth transition between states
3. THE Application SHALL render the Topbar at a fixed height of 56px pinned to the top of the viewport
4. THE Application SHALL render the main content area with consistent padding of 24px on all sides
5. WHILE the viewport width is at or above Desktop_Viewport (1024px), THE Application SHALL display the Sidebar and content area side by side without horizontal scrolling
6. THE Application SHALL align all page sections, cards, and form groups to a consistent vertical rhythm using spacing tokens

### Requirement 7: Component Standardization — Buttons

**User Story:** As a user, I want buttons to look and behave consistently, so that I can identify actionable elements without confusion.

#### Acceptance Criteria

1. THE Design_System SHALL define button variants: primary (filled, brand color), secondary (outlined), danger (filled, error color), and ghost (text-only)
2. THE Design_System SHALL define button sizes: small (height 32px, font-size 12px), medium (height 40px, font-size 14px), and large (height 48px, font-size 16px)
3. WHEN the user hovers over a button, THE Application SHALL display a hover state with a color shift and subtle elevation change within 150ms
4. WHEN a button receives keyboard focus, THE Application SHALL display a Focus_Indicator using a 2px ring offset by 2px in the brand primary color
5. WHEN a button is disabled, THE Application SHALL render the button at reduced opacity (0.5) with cursor: not-allowed and suppress hover/active state changes
6. THE Application SHALL render all buttons with border-radius from the Design_System radius-full token (pill shape)

### Requirement 8: Component Standardization — Form Controls

**User Story:** As a user, I want form inputs to be visually consistent and clearly indicate their state, so that I can fill out forms efficiently and without error.

#### Acceptance Criteria

1. THE Design_System SHALL define form control styling: minimum height 40px, border-radius from radius-md token (8px), border width 1.5px, font-size 14px
2. WHEN a form control receives focus, THE Application SHALL display a focus ring using the brand primary Color_Token with 3px spread
3. WHEN a form control is in an error state, THE Application SHALL display a red border using the semantic error Color_Token and an error message below the field in the same color
4. WHEN a form control is disabled, THE Application SHALL display a light gray background using neutral-100 Color_Token and reduce text opacity
5. THE Application SHALL render form labels above their associated inputs at font-size 12px, font-weight 600, and color neutral-600
6. THE Application SHALL associate each form label with its corresponding input using the HTML for/id attribute pairing

### Requirement 9: Component Standardization — Cards and Containers

**User Story:** As a user, I want content grouped in consistent card containers, so that I can visually parse page sections and data groupings.

#### Acceptance Criteria

1. THE Design_System SHALL define card styling: white background (surface-card token), border-radius from radius-lg token (12px), 1px border using neutral-200, shadow from shadow-sm token, and padding from spacing tokens
2. THE Design_System SHALL define a KPI card variant with: icon container, metric value at font-size xl and font-weight bold, label at font-size sm and color neutral-600, and a hover elevation effect
3. THE Application SHALL render page header cards with flexbox layout (space-between alignment), consistent vertical padding, and bottom margin matching spacing-5 token
4. THE Application SHALL render all card containers without conflicting box-shadow or border declarations across different feature pages

### Requirement 10: Component Standardization — Data Tables

**User Story:** As a user, I want data tables that are easy to read and interact with, so that I can find and manage patient and medical records efficiently.

#### Acceptance Criteria

1. THE Application SHALL render table headers with font-size 12px, font-weight 700, uppercase letter-spacing, neutral-600 text color, and neutral-50 background
2. THE Application SHALL render table rows with vertical padding of 12px and horizontal padding of 16px per cell
3. WHEN the user hovers over a table row, THE Application SHALL highlight the row with a subtle background change using the neutral-50 Color_Token
4. THE Application SHALL render table row borders using a 1px solid line in neutral-200 Color_Token
5. THE Application SHALL render sortable column headers with a visual indicator (icon) showing sort direction and brand-primary color when active
6. WHEN a table contains no data, THE Application SHALL display an empty-state illustration or message centered within the table area

### Requirement 11: Component Standardization — Navigation (Sidebar and Topbar)

**User Story:** As a user, I want clear, intuitive navigation, so that I can move between application sections without confusion.

#### Acceptance Criteria

1. THE Sidebar SHALL display navigation items with icon (20px), label text (14px, medium weight), and active-state indicator using the brand primary Color_Token background highlight
2. WHEN the user hovers over a Sidebar navigation item, THE Sidebar SHALL display a hover background using neutral-100 or primary-50 Color_Token within 150ms
3. THE Sidebar SHALL group navigation items under section headings styled with uppercase, letter-spacing, neutral-500 color, and font-size 11px
4. THE Topbar SHALL display the application logo/brand mark, a theme mode toggle, notification indicator, and user avatar/menu aligned horizontally
5. WHEN the Sidebar is in collapsed state (64px width), THE Sidebar SHALL display only icons with tooltip labels appearing on hover
6. THE Sidebar SHALL render a visual active indicator (left border or background highlight) on the currently selected navigation item

### Requirement 12: Component Standardization — Status Badges

**User Story:** As a user, I want status badges to be visually distinct and consistent, so that I can quickly identify record states across all pages.

#### Acceptance Criteria

1. THE Design_System SHALL define a badge component with consistent structure: inline-flex display, pill shape (radius-full), padding 3px vertical and 10px horizontal, font-size 11px, font-weight 600, uppercase text
2. THE Design_System SHALL define badge color variants using semantic and contextual colors: success (green), warning (amber), error (red), info (blue), neutral (gray), and brand-specific variants (pending, approved, rejected, draft, active, inactive)
3. THE Application SHALL render all status badges using the unified badge component across all 13 Feature_Pages
4. WHEN dark mode is active, THE Design_System SHALL adjust badge background and text colors to maintain a Contrast_Ratio of 4.5:1 or greater

### Requirement 13: Component Standardization — Dialogs and Modals

**User Story:** As a user, I want modals and dialogs to be clear, focused, and consistent, so that I can complete actions and confirmations without distraction.

#### Acceptance Criteria

1. THE Application SHALL render dialogs with border-radius from radius-lg token (12px), a header section with title and close button, a scrollable content section, and a footer with action buttons
2. THE Application SHALL display a backdrop overlay at 45% opacity dark when a dialog is open
3. WHEN a dialog opens, THE Application SHALL trap keyboard focus within the dialog until the dialog is dismissed
4. WHEN the user presses the Escape key while a dialog is open, THE Application SHALL close the dialog
5. THE Application SHALL render dialog headers with padding 20px 24px, font-weight 700, border-bottom using neutral-200 Color_Token
6. THE Application SHALL render dialog footers with background neutral-50, border-top using neutral-200 Color_Token, and action buttons aligned to the right with 10px gap

### Requirement 14: Accessibility — WCAG 2.1 AA Compliance

**User Story:** As a user with accessibility needs, I want the application to be fully navigable and perceivable using assistive technologies, so that I can perform my work without barriers.

#### Acceptance Criteria

1. THE Application SHALL ensure all text-on-background color combinations meet a Contrast_Ratio of 4.5:1 for normal text (below 18px) and 3:1 for large text (18px or 14px bold)
2. THE Application SHALL render a visible Focus_Indicator on all interactive elements (buttons, links, inputs, selects, checkboxes, radio buttons) when focused via keyboard
3. THE Application SHALL support full keyboard navigation of all interactive flows including form submission, table sorting, dialog interaction, sidebar navigation, and dropdown selection without requiring a mouse
4. THE Application SHALL assign appropriate ARIA roles and labels to all custom components: navigation landmarks (role="navigation"), dialog (role="dialog", aria-modal="true"), status badges (role="status"), and form error messages (aria-live="polite")
5. THE Application SHALL render all images and icons with descriptive alt text or aria-label, or mark decorative images with aria-hidden="true" and an empty alt attribute
6. THE Application SHALL provide visible skip-navigation links that allow keyboard users to bypass repeated navigation and jump to main content
7. WHEN a form validation error occurs, THE Application SHALL programmatically associate the error message with the invalid input using aria-describedby

### Requirement 15: CSS Architecture and Code Quality

**User Story:** As a developer, I want a clean, maintainable CSS codebase free of conflicts and overrides, so that future styling changes are predictable and low-risk.

#### Acceptance Criteria

1. THE Application SHALL contain zero CSS !important declarations in the global stylesheet for PrimeNG component overrides (theme integration handles specificity through proper means)
2. THE Application SHALL contain zero inline style attributes in component HTML templates for layout or visual styling purposes
3. THE Application SHALL remove all unused CSS classes, duplicate rule declarations, and dead selectors from the global stylesheet and component styles
4. THE Application SHALL use CSS custom properties (design tokens) for all color, spacing, radius, shadow, and typography values rather than hardcoded literals
5. THE Application SHALL organize styles in Tailwind CSS layers (@layer base, @layer components, @layer utilities) to control specificity without !important
6. THE Application SHALL scope component-specific styles using Angular component encapsulation (ViewEncapsulation.Emulated) rather than global selectors where possible
7. WHEN a new component is created, THE Application SHALL use design tokens exclusively for visual property values

### Requirement 16: Feature Page Consistency

**User Story:** As a user, I want every page in the application to look and feel like part of the same product, so that my experience is predictable and professional.

#### Acceptance Criteria

1. THE Application SHALL render all 13 Feature_Pages with a consistent page layout: page header card at top, content area below, and consistent left/top padding from the app shell
2. THE Application SHALL render page titles across all Feature_Pages with font-size lg (18px), font-weight 700, and color neutral-900
3. THE Application SHALL render action buttons in page headers with consistent positioning (right-aligned), sizing (medium variant), and spacing (8px gap between multiple buttons)
4. THE Application SHALL apply identical card styling, table styling, and form styling across all Feature_Pages using shared Design_System classes
5. WHEN a Feature_Page displays a list view, THE Application SHALL use the standardized data table component with consistent pagination placement, row density, and empty state handling
6. WHEN a Feature_Page displays a form view, THE Application SHALL use the standardized form layout with consistent label placement, field spacing (16px between fields), and validation messaging

### Requirement 17: Animations and Transitions

**User Story:** As a user, I want smooth, purposeful animations, so that state changes feel natural and I maintain context of what changed.

#### Acceptance Criteria

1. THE Application SHALL apply transition animations on interactive state changes (hover, focus, active) using the duration-fast token (150ms) with ease-out easing
2. THE Application SHALL apply entry animations on overlay components (dialogs, dropdowns, tooltips) using the duration-normal token (250ms) with a subtle scale or translate transform
3. THE Application SHALL respect the user's prefers-reduced-motion media query by disabling non-essential animations when the preference is set to reduce
4. THE Application SHALL animate Sidebar expand/collapse transitions using the duration-normal token (250ms) with ease-out easing
5. THE Application SHALL limit animation usage to functional purposes (state feedback, context preservation, attention direction) and avoid purely decorative or looping animations

### Requirement 18: Responsive Desktop Layout

**User Story:** As a user working on a desktop monitor, I want the interface to make full use of available screen space, so that I can view data-dense medical records comfortably.

#### Acceptance Criteria

1. WHILE the viewport width is at or above 1024px, THE Application SHALL display the full two-column layout (Sidebar plus content area) without horizontal overflow
2. WHILE the viewport width is at or above 1280px, THE Application SHALL expand content area grids (KPI cards, dashboard widgets) to utilize available horizontal space
3. WHILE the viewport width is at or above 1440px, THE Application SHALL display up to 4 KPI cards per row in dashboard views
4. THE Application SHALL render data tables with horizontal scroll capability when column content exceeds the available content width
5. THE Application SHALL set a maximum content width of 1600px centered within the viewport for readability on ultra-wide displays
