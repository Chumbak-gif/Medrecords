# Design Document: UI/UX Overhaul

## Overview

This design document defines the architecture for overhauling the MEDRecords Angular 17 application's visual layer. The overhaul replaces the red-branded Emcure Design System with a healthcare-focused blue/teal design token architecture, adds a custom PrimeNG theme, implements dark/light mode switching with localStorage persistence, achieves WCAG 2.1 AA compliance, and standardizes all 13 feature pages plus shared components for a consistent desktop-first medical SaaS experience.

## Architecture

The UI/UX overhaul restructures the MEDRecords Angular 17 application's visual layer into a token-driven design system. The architecture follows a layered approach:

```
┌─────────────────────────────────────────────────────────┐
│                   Feature Pages (13)                      │
│  analytics-admin, assessments, patients, doctors, etc.   │
├─────────────────────────────────────────────────────────┤
│              Shared Components (8)                        │
│  sidebar, topbar, kpi-card, status-badge, etc.           │
├─────────────────────────────────────────────────────────┤
│              PrimeNG Theme Layer                          │
│  Custom theme consuming design tokens                    │
├─────────────────────────────────────────────────────────┤
│              Theme Engine (Dark/Light)                    │
│  ThemeService + localStorage persistence                 │
├─────────────────────────────────────────────────────────┤
│              Design Token Foundation                      │
│  CSS custom properties in :root / [data-theme="dark"]    │
├─────────────────────────────────────────────────────────┤
│              Tailwind CSS Configuration                   │
│  Token-mapped utilities + @layer organization            │
└─────────────────────────────────────────────────────────┘
```

All visual values flow from the token foundation upward. No component directly references hardcoded color, spacing, or typography values.

## Components and Interfaces

### 1. Design Token Foundation (`styles.css` `:root` block)

Defines all CSS custom properties organized into semantic layers:

```typescript
// Token categories defined in :root
interface DesignTokens {
  // Brand layer
  '--color-primary-50' through '--color-primary-900': string;
  '--color-secondary': string;

  // Neutral layer (0-900 scale)
  '--color-neutral-0' through '--color-neutral-900': string;

  // Semantic layer
  '--color-success': string;       // base
  '--color-success-bg': string;    // light background
  '--color-success-text': string;  // dark text variant
  '--color-warning': string;
  '--color-warning-bg': string;
  '--color-warning-text': string;
  '--color-error': string;
  '--color-error-bg': string;
  '--color-error-text': string;
  '--color-info': string;
  '--color-info-bg': string;
  '--color-info-text': string;

  // Surface layer
  '--surface-background': string;
  '--surface-card': string;
  '--surface-elevated': string;
  '--surface-overlay': string;

  // Spacing (4px base)
  '--space-1' through '--space-16': string;

  // Typography
  '--font-sans': string;
  '--font-mono': string;
  '--text-xs' through '--text-2xl': string;
  '--leading-tight' | '--leading-normal' | '--leading-relaxed': string;
  '--font-light' through '--font-bold': string;

  // Radius
  '--radius-sm' | '--radius-md' | '--radius-lg' | '--radius-xl' | '--radius-full': string;

  // Elevation
  '--shadow-sm' | '--shadow-md' | '--shadow-lg': string;

  // Motion
  '--duration-fast' | '--duration-normal' | '--duration-slow': string;
  '--ease-out' | '--ease-spring': string;
}
```

### 2. Theme Engine (`ThemeService`)

An Angular injectable service managing dark/light mode:

```typescript
// frontend/src/app/core/theme/theme.service.ts
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'medrecords-theme';
  readonly mode = signal<'light' | 'dark'>(this.loadPreference());

  toggle(): void {
    const next = this.mode() === 'light' ? 'dark' : 'light';
    this.mode.set(next);
    this.applyTheme(next);
    localStorage.setItem(this.STORAGE_KEY, next);
  }

  private loadPreference(): 'light' | 'dark' {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  }

  private applyTheme(mode: 'light' | 'dark'): void {
    document.documentElement.setAttribute('data-theme', mode);
  }
}
```

Theme switching works via a `[data-theme="dark"]` selector that overrides surface and color tokens:

```css
[data-theme="dark"] {
  --surface-background: #0f1419;
  --surface-card: #1a2027;
  --surface-elevated: #242d35;
  --surface-overlay: rgba(0, 0, 0, 0.6);
  --color-neutral-0: #0f1419;
  --color-neutral-50: #1a2027;
  --color-neutral-100: #242d35;
  /* ... inverted scale ... */
  --color-neutral-900: #f1f5f9;
  /* Brand colors adjusted for dark backgrounds */
  --color-primary: #22d3ee;  /* lighter cyan for contrast */
}
```

### 3. PrimeNG Theme Integration

Instead of `!important` overrides, the custom theme uses Angular's `ViewEncapsulation.None` on a dedicated theme component and PrimeNG's `styleClass` bindings with proper CSS specificity through `:root` token consumption:

```css
/* PrimeNG consumes tokens via cascading specificity */
:root .p-datatable .p-datatable-thead > tr > th {
  background: var(--color-neutral-50);
  color: var(--color-neutral-600);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  padding: var(--space-3) var(--space-4);
  border-bottom: 2px solid var(--color-neutral-200);
}

:root .p-dialog {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

:root .p-inputtext {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  min-height: 40px;
  border: 1.5px solid var(--color-neutral-300);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  transition: border-color var(--duration-fast) var(--ease-out),
              box-shadow var(--duration-fast) var(--ease-out);
}

:root .p-inputtext:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}
```

### 4. Tailwind CSS Configuration

```typescript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          50: 'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          // ... through 900
        },
        neutral: {
          0: 'var(--color-neutral-0)',
          50: 'var(--color-neutral-50)',
          // ... through 900
        },
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        info: 'var(--color-info)',
        surface: {
          bg: 'var(--surface-background)',
          card: 'var(--surface-card)',
          elevated: 'var(--surface-elevated)',
        }
      },
      spacing: {
        '1': 'var(--space-1)',
        '2': 'var(--space-2)',
        // ... mapped to token scale
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
      }
    }
  },
  plugins: []
}
```


### 5. Shared Component Updates

#### Sidebar (`app-sidebar`)

```typescript
// Updated sidebar with design token consumption and accessibility
@Component({
  selector: 'app-sidebar',
  standalone: true,
  // styles use only CSS custom properties
  styles: [`
    .sidebar {
      width: 240px;  /* updated from 220px */
      background: var(--surface-card);
      border-right: 1px solid var(--color-neutral-200);
      transition: width var(--duration-normal) var(--ease-out);
    }
    .sidebar.collapsed { width: 64px; }
    .nav-link {
      color: var(--color-neutral-600);
      font-size: var(--text-base);
      font-weight: var(--font-medium);
      border-radius: var(--radius-md);
      padding: var(--space-2) var(--space-3);
      transition: all var(--duration-fast) var(--ease-out);
    }
    .nav-link:hover {
      background: var(--color-primary-50);
      color: var(--color-primary);
    }
    .nav-link-active {
      background: var(--color-primary-50);
      color: var(--color-primary);
      font-weight: var(--font-semibold);
      border-left: 3px solid var(--color-primary);
    }
    .nav-link:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
    .section-heading {
      font-size: 11px;
      font-weight: var(--font-bold);
      color: var(--color-neutral-500);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: var(--space-2) var(--space-3);
    }
  `]
})
```

#### Topbar (`app-topbar`)

Updated to include theme toggle and notification indicator:

```typescript
@Component({
  selector: 'app-topbar',
  template: `
    <header class="topbar" role="banner">
      <div class="topbar-left">
        <button class="hamburger-btn" (click)="sidebarToggle.emit()"
                aria-label="Toggle sidebar">
          <i class="pi pi-bars"></i>
        </button>
        <img src="assets/logo.svg" alt="MEDRecords" class="brand-logo" />
      </div>
      <div class="topbar-right">
        <button class="theme-toggle" (click)="theme.toggle()"
                [attr.aria-label]="'Switch to ' + (theme.mode() === 'light' ? 'dark' : 'light') + ' mode'">
          <i [class]="theme.mode() === 'light' ? 'pi pi-moon' : 'pi pi-sun'"></i>
        </button>
        <button class="notification-btn" aria-label="Notifications">
          <i class="pi pi-bell"></i>
        </button>
        <div class="user-avatar">
          <!-- User menu -->
        </div>
      </div>
    </header>
  `
})
```

#### Status Badge (`app-status-badge`)

Refactored to a single unified component with token-driven color mapping:

```typescript
@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    <span class="badge" [attr.role]="'status'"
          [style.--badge-bg]="colorMap[status]?.bg"
          [style.--badge-text]="colorMap[status]?.text">
      {{ status | titlecase }}
    </span>
  `,
  styles: [`
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: var(--radius-full);
      font-size: 11px;
      font-weight: var(--font-semibold);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: var(--badge-bg);
      color: var(--badge-text);
    }
  `]
})
export class StatusBadgeComponent {
  @Input() status: string = '';
  colorMap: Record<string, { bg: string; text: string }> = {
    active:    { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
    approved:  { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
    pending:   { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' },
    rejected:  { bg: 'var(--color-error-bg)',   text: 'var(--color-error-text)' },
    error:     { bg: 'var(--color-error-bg)',   text: 'var(--color-error-text)' },
    draft:     { bg: 'var(--color-info-bg)',    text: 'var(--color-info-text)' },
    inactive:  { bg: 'var(--color-neutral-100)', text: 'var(--color-neutral-600)' },
    // ... additional variants
  };
}
```

#### KPI Card (`app-kpi-card`)

```typescript
@Component({
  selector: 'app-kpi-card',
  template: `
    <div class="kpi-card">
      <div class="kpi-icon">
        <i [class]="'pi ' + icon" aria-hidden="true"></i>
      </div>
      <div class="kpi-content">
        <span class="kpi-value">{{ value }}</span>
        <span class="kpi-label">{{ title }}</span>
      </div>
    </div>
  `,
  styles: [`
    .kpi-card {
      background: var(--surface-card);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--color-neutral-200);
      padding: var(--space-5);
      display: flex;
      align-items: center;
      gap: var(--space-4);
      transition: all var(--duration-normal) var(--ease-spring);
    }
    .kpi-card:hover {
      border-color: var(--color-primary);
      box-shadow: var(--shadow-md);
      transform: translateY(-2px);
    }
    .kpi-value {
      font-size: var(--text-xl);
      font-weight: var(--font-bold);
      color: var(--color-neutral-900);
    }
    .kpi-label {
      font-size: var(--text-sm);
      color: var(--color-neutral-600);
    }
  `]
})
```

### 6. App Shell Layout

```typescript
@Component({
  selector: 'app-shell',
  template: `
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <div class="app-shell">
      <app-sidebar [collapsed]="sidebarCollapsed()"
                   (collapsedChange)="sidebarCollapsed.set($event)" />
      <div class="app-main">
        <app-topbar (sidebarToggle)="toggleSidebar()" />
        <main id="main-content" class="app-content" role="main">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .skip-link {
      position: absolute;
      top: -100%;
      left: var(--space-4);
      padding: var(--space-2) var(--space-4);
      background: var(--color-primary);
      color: white;
      border-radius: var(--radius-md);
      z-index: 9999;
      transition: top var(--duration-fast) var(--ease-out);
    }
    .skip-link:focus {
      top: var(--space-2);
    }
    .app-shell {
      display: flex;
      min-height: 100vh;
    }
    .app-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      max-width: 1600px;
    }
    .app-content {
      padding: var(--space-6);
      flex: 1;
      overflow-y: auto;
    }
  `]
})
```


### Interfaces

### ThemeService Interface

```typescript
interface IThemeService {
  readonly mode: Signal<'light' | 'dark'>;
  toggle(): void;
}
```

### Design Token Contracts

```typescript
// Token validation types (used in tests)
interface ColorToken {
  name: string;
  value: string;         // CSS value (hex, hsl, rgb, or var reference)
  hue?: number;          // HSL hue component (0-360)
  saturation?: number;   // HSL saturation (0-100)
  lightness?: number;    // HSL lightness (0-100)
}

interface TokenLayer {
  brand: ColorToken[];
  neutral: ColorToken[];
  semantic: ColorToken[];
  surface: ColorToken[];
}

interface SpacingToken {
  name: string;
  value: number;  // in pixels, must be multiple of 4
}

interface ContrastPair {
  foreground: ColorToken;
  background: ColorToken;
  ratio: number;          // computed contrast ratio
  isLargeText: boolean;
  passes: boolean;        // meets AA threshold
}
```

### Badge Color Map Interface

```typescript
interface BadgeColorConfig {
  bg: string;    // CSS variable reference for background
  text: string;  // CSS variable reference for text color
}

type BadgeVariant =
  | 'active' | 'inactive' | 'pending' | 'approved' | 'rejected'
  | 'draft' | 'submitted' | 'error' | 'success' | 'warning' | 'info';

type BadgeColorMap = Record<BadgeVariant, BadgeColorConfig>;
```

### Page Layout Interface

```typescript
// Every feature page follows this structure
interface PageLayout {
  header: {
    title: string;
    actions?: ActionButton[];
  };
  content: {
    type: 'list' | 'form' | 'dashboard' | 'detail';
  };
}

interface ActionButton {
  label: string;
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  icon?: string;
}
```

## Data Models

### Theme State

```typescript
interface ThemeState {
  mode: 'light' | 'dark';
  persisted: boolean;
}
```

### Token Registry

```typescript
// Runtime representation of all design tokens (for validation/testing)
interface TokenRegistry {
  colors: {
    brand: Record<string, string>;     // primary-50 through primary-900
    neutral: Record<string, string>;   // neutral-0 through neutral-900
    semantic: Record<string, string>;  // success, warning, error, info + variants
    surface: Record<string, string>;   // background, card, elevated, overlay
  };
  spacing: Record<string, number>;     // space-1 through space-16
  typography: {
    fontFamily: Record<string, string>;
    fontSize: Record<string, string>;
    fontWeight: Record<string, number>;
    lineHeight: Record<string, number>;
  };
  radius: Record<string, string>;
  shadow: Record<string, string>;
  motion: {
    duration: Record<string, string>;
    easing: Record<string, string>;
  };
}
```

### Button Configuration

```typescript
interface ButtonConfig {
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  height: number;    // 32, 40, or 48
  fontSize: number;  // 12, 14, or 16
  borderRadius: string; // always radius-full
}
```

## Error Handling

### Theme Service Errors

| Scenario | Handling |
|----------|----------|
| localStorage unavailable (private browsing) | Fallback to in-memory state, default light mode |
| Corrupted localStorage value | Ignore stored value, default to light mode |
| CSS variable not defined | Each token has a fallback value in the CSS declaration |

### Token Validation Errors

| Scenario | Handling |
|----------|----------|
| Missing required token | Build-time lint warning via stylelint custom rule |
| Hardcoded color in component | Build-time lint error |
| Contrast ratio below threshold | Compile-time token audit flags violation |

### Component Graceful Degradation

| Scenario | Handling |
|----------|----------|
| Custom font (Poppins) fails to load | system-ui fallback renders immediately |
| PrimeNG theme variable missing | Component renders with browser defaults, remains functional |
| Dark mode toggle fails | UI stays in current mode, no crash |
| prefers-reduced-motion detected | All transition-duration set to 0ms via media query override |

## Accessibility Architecture

### Focus Management Strategy

```css
/* Global focus-visible styles */
:root *:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Suppress focus ring for mouse clicks */
:root *:focus:not(:focus-visible) {
  outline: none;
}
```

### ARIA Landmark Structure

```html
<body>
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <nav aria-label="Primary navigation"><!-- sidebar --></nav>
  <header role="banner"><!-- topbar --></header>
  <main id="main-content" role="main"><!-- content --></main>
</body>
```

### Dialog Accessibility Pattern

```typescript
// Focus trap implementation for dialogs
// PrimeNG p-dialog already provides:
// - role="dialog"
// - aria-modal="true"
// - Escape key handling
// - Focus trap
// Custom additions:
// - aria-labelledby pointing to dialog title
// - aria-describedby for dialog description when present
```

### Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```


## Color Palette Specification

### Primary Palette (Healthcare Blue/Teal)

| Step | Hex | Usage |
|------|-----|-------|
| 50   | #ecfeff | Hover backgrounds, subtle highlights |
| 100  | #cffafe | Focus rings, light accents |
| 200  | #a5f3fc | Badge backgrounds (light) |
| 300  | #67e8f9 | Decorative elements |
| 400  | #22d3ee | Dark mode primary |
| 500  | #06b6d4 | **Brand primary** |
| 600  | #0891b2 | Hover states |
| 700  | #0e7490 | Active states |
| 800  | #155e75 | Dark accents |
| 900  | #164e63 | Headings on light background |

HSL base: `hsl(189, 94%, 43%)` — hue 189° sits within the 180–210 healthcare range.

### Neutral Scale

| Step | Hex | Usage |
|------|-----|-------|
| 0    | #ffffff | Pure white backgrounds |
| 50   | #f8fafc | Table headers, subtle backgrounds |
| 100  | #f1f5f9 | Disabled backgrounds, page bg |
| 200  | #e2e8f0 | Borders, dividers |
| 300  | #cbd5e1 | Input borders |
| 400  | #94a3b8 | Placeholder text |
| 500  | #64748b | Secondary text, icons |
| 600  | #475569 | Label text |
| 700  | #334155 | Body text (dark mode) |
| 800  | #1e293b | Headings |
| 900  | #0f172a | Primary text |

### Semantic Colors

| Category | Base | Light BG | Dark Text |
|----------|------|----------|-----------|
| Success  | #10b981 | #ecfdf5 | #065f46 |
| Warning  | #f59e0b | #fffbeb | #92400e |
| Error    | #ef4444 | #fef2f2 | #991b1b |
| Info     | #3b82f6 | #eff6ff | #1e40af |

## File Organization

```
frontend/src/
├── styles.css                          # Token definitions + @layer base/components/utilities
├── styles/
│   └── primeng-theme.css               # PrimeNG token-based overrides (no !important)
├── app/
│   ├── core/
│   │   └── theme/
│   │       └── theme.service.ts        # ThemeService (dark/light mode)
│   ├── shared/
│   │   └── components/
│   │       ├── app-shell/
│   │       ├── sidebar/
│   │       ├── topbar/
│   │       ├── kpi-card/
│   │       ├── status-badge/
│   │       ├── dynamic-form/
│   │       ├── prescription-grid/
│   │       └── followup-dialog/
│   └── features/                       # 13 feature modules (unchanged structure)
└── tailwind.config.js                  # Token-mapped Tailwind config
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Spacing tokens follow 4px base unit

*For any* spacing token defined in the design system, its pixel value SHALL be a multiple of 4.

**Validates: Requirements 1.3, 6.1**

### Property 2: Primary color hue within healthcare range

*For any* color token in the brand primary scale (50–900), its HSL hue component SHALL fall within the range 180–210 degrees.

**Validates: Requirements 1.2, 4.1**

### Property 3: No hardcoded visual values in component styles

*For any* Angular component template file (.html) in the application, there SHALL be zero inline `style` attributes containing color hex values, pixel spacing literals, or font-size literals. *For any* component CSS file, there SHALL be zero hardcoded color hex values — all colors must reference CSS custom properties.

**Validates: Requirements 1.8, 15.2, 15.4, 15.7**

### Property 4: PrimeNG theme consumes design tokens exclusively

*For any* CSS rule targeting a PrimeNG component selector (`.p-*`) in the theme stylesheet, all color, spacing, radius, and shadow property values SHALL reference CSS custom properties (var(--*)) rather than hardcoded literals.

**Validates: Requirements 2.1**

### Property 5: Zero !important declarations in theme stylesheet

*For any* CSS rule in the global stylesheet and PrimeNG theme file, there SHALL be zero `!important` declarations used for PrimeNG component styling.

**Validates: Requirements 2.6, 15.1**

### Property 6: Dark mode surface lightness constraint

*For any* surface color token (background, card, elevated) when dark mode is active, its HSL lightness component SHALL be below 20%. *For any* text color token in dark mode, its HSL lightness SHALL be above 80%.

**Validates: Requirements 3.2**

### Property 7: Theme mode round-trip preservation

*For any* initial theme mode (light or dark), toggling the theme twice SHALL restore the exact same set of computed CSS custom property values as the original state.

**Validates: Requirements 3.3**

### Property 8: Theme preference localStorage persistence round-trip

*For any* theme mode value written to localStorage, reading the stored value and applying it SHALL produce the same visual state as the original toggle action.

**Validates: Requirements 3.4**

### Property 9: WCAG AA contrast ratio compliance

*For any* text-on-background color pair defined in the design system (both light and dark modes), the computed contrast ratio SHALL be >= 4.5:1 for normal text (below 18px) and >= 3:1 for large text (18px or 14px bold).

**Validates: Requirements 3.7, 4.4, 12.4, 14.1**

### Property 10: Semantic colors have complete variant sets

*For any* semantic color category (success, warning, error, info), the design system SHALL define exactly three variants: base, light-background, and dark-text.

**Validates: Requirements 4.3**

### Property 11: Button pill-shape invariant

*For any* button element rendered with a design system button class (btn-primary, btn-secondary, btn-danger, btn-ghost), its computed border-radius SHALL equal the radius-full token value (9999px).

**Validates: Requirements 7.6**

### Property 12: Form label-input accessibility pairing

*For any* form field in the application, (a) the label element's `for` attribute SHALL match the input element's `id` attribute, and (b) when the field is in error state, the error message element's `id` SHALL be referenced by the input's `aria-describedby` attribute.

**Validates: Requirements 8.6, 14.7**

### Property 13: Badge structural invariant

*For any* status badge rendered in the application, it SHALL have: display inline-flex, border-radius equal to radius-full, padding of 3px vertical / 10px horizontal, font-size 11px, font-weight 600, and text-transform uppercase.

**Validates: Requirements 12.1**

### Property 14: Unified badge component usage across pages

*For any* feature page in the 13 feature modules, all status indicators SHALL be rendered using the shared `app-status-badge` component — no feature page SHALL define its own inline badge styling.

**Validates: Requirements 12.3**

### Property 15: Focus indicator visibility on interactive elements

*For any* interactive element (button, link, input, select, checkbox, radio) when focused via keyboard (`:focus-visible`), a visible focus ring SHALL be present with a minimum 2px outline width and brand primary color.

**Validates: Requirements 7.4, 14.2**

### Property 16: ARIA attributes on custom components

*For any* custom component with a semantic role (sidebar navigation, dialogs, status badges, form errors), the appropriate ARIA attributes SHALL be present: navigation elements have `role="navigation"` or `<nav>`, dialogs have `role="dialog"` and `aria-modal="true"`, badges have `role="status"`, and live regions use `aria-live="polite"`.

**Validates: Requirements 14.4**

### Property 17: Image and icon accessibility

*For any* `<img>` element or icon element in the application, it SHALL either have a descriptive `alt` attribute (or `aria-label`) OR be marked as decorative with `aria-hidden="true"` and an empty `alt=""`.

**Validates: Requirements 14.5**

### Property 18: Page layout structural consistency

*For any* of the 13 feature pages, the rendered DOM SHALL contain: (a) a page header section with title and optional action buttons, (b) a main content area with consistent padding from the app shell, and (c) page titles at font-size 18px with font-weight 700.

**Validates: Requirements 16.1, 16.2, 16.3**

### Property 19: Transition duration token compliance

*For any* interactive element with a CSS transition property, the transition-duration value SHALL reference a design token (duration-fast, duration-normal, or duration-slow) rather than a hardcoded millisecond value.

**Validates: Requirements 17.1**

### Property 20: Reduced motion preference respect

*For any* element with a CSS animation or transition, when the `prefers-reduced-motion: reduce` media query is active, the effective animation/transition duration SHALL be effectively zero (≤ 1ms).

**Validates: Requirements 17.3**


## Testing Strategy

### Property-Based Tests

Properties 1–20 above are implemented as property-based tests using a CSS/token parser utility. The test framework generates:

- **Token inputs**: Random selections from the defined token registry to verify invariants across the full token set
- **Color pairs**: Random foreground/background combinations to validate contrast ratios
- **Component instances**: Random badge variants, button configurations, and form field states
- **Theme states**: Random toggle sequences to verify round-trip preservation

Minimum 100 iterations per property test.

### Example-Based Tests

Specific acceptance criteria not suited for property testing are covered by focused unit tests:

- Theme defaults to light when localStorage is empty (Req 3.5)
- Sidebar renders at exactly 240px expanded and 64px collapsed (Req 6.2)
- Topbar renders at exactly 56px height (Req 6.3)
- Skip-navigation link is present and functional (Req 14.6)
- Dialog Escape key closes the dialog (Req 13.4)
- PrimeNG overlay panels render with correct token-based colors (Req 2.7)

### Integration Tests

- Full page render of each feature module to verify layout consistency
- Dark/light mode toggle with PrimeNG components rendered
- Keyboard navigation flow through sidebar → content → dialogs

### Accessibility Audit

- Automated axe-core scan on each feature page in both light and dark modes
- Manual screen reader testing for dialog focus traps and ARIA landmarks
