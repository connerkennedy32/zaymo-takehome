# Zaymo Styling Guide

All UI in this project follows the Zaymo brand design system. Match these conventions exactly when building or modifying components.

## Color Palette

These CSS custom properties are defined in `src/app/globals.css` and available via Tailwind's `bg-*`, `text-*`, `border-*` utilities.

### Dark mode (default)
| Token | Value | Usage |
|---|---|---|
| `--background` | `#1a1a1a` | Page/app background |
| `--foreground` | `#ffffff` | Primary text |
| `--card` | `#242422` | Cards, dropdowns, popovers |
| `--primary` | `#def223` | Buttons, active states, key actions |
| `--primary-foreground` | `#1a1a1a` | Text on primary (yellow) surfaces |
| `--secondary` | `#41413e` | Secondary buttons, tags |
| `--secondary-foreground` | `#f7f7f7` | Text on secondary surfaces |
| `--muted` | `#2a2a28` | Subtle backgrounds, hover states |
| `--muted-foreground` | `#8c8c83` | Placeholder text, secondary labels |
| `--accent` | `#ecff47` | Hover highlight on yellow elements |
| `--accent-foreground` | `#1a1a1a` | Text on accent surfaces |
| `--border` | `#41413e` | All borders and dividers |
| `--input` | `#2a2a28` | Input field backgrounds |
| `--ring` | `#def223` | Focus rings |
| `--destructive` | red (oklch) | Error states, destructive actions |

### Light mode
| Token | Value | Usage |
|---|---|---|
| `--background` | `#f7f7f7` | Page background |
| `--foreground` | `#1a1a1a` | Primary text |
| `--primary` | `#1a1a1a` | Buttons |
| `--primary-foreground` | `#def223` | Text on primary |
| `--muted` | `#e8e8e4` | Subtle backgrounds |
| `--muted-foreground` | `#8c8c83` | Secondary labels |
| `--accent` | `#def223` | Acid-yellow accent |
| `--border` | `#dadad8` | Borders |

### Raw brand values (for inline styles or non-Tailwind use)
```
Acid yellow:     #def223   (primary CTA color)
Yellow glow:     #ecff47   (hover state of yellow)
Yellow tint:     #faffce   (very light yellow, backgrounds)
Brand black:     #1a1a1a
Brand white:     #ffffff
Dark gray:       #8c8c83
Neutral 300:     #dadad8
Neutral 800:     #41413e
Neutral 950:     #1a1a19
```

## Typography

**Font family:** DM Sans (loaded via `next/font/google`, available as `--font-dm-sans`)  
DM Sans is used as a stand-in for Zaymo's proprietary ABCFavorit — both are geometric grotesque sans-serifs.

**Weights in use:** 300 (light), 400 (regular), 500 (medium)  
**Mono font:** DM Mono (`--font-dm-mono`)

- Use `font-medium` (500) for labels, headings, button text
- Use `font-normal` (400) for body text
- Use `font-light` (300) sparingly for large display text
- Use `tracking-tight` on headings

## Border Radius

Base radius is `0.375rem` — smaller than typical shadcn defaults to match Zaymo's angular, geometric aesthetic.

| Token | Value |
|---|---|
| `rounded-sm` | `~0.225rem` |
| `rounded` / `rounded-md` | `~0.3rem` |
| `rounded-lg` | `0.375rem` |
| `rounded-xl` | `~0.525rem` |
| `rounded-full` | pill shape — use only for badges/avatars |

Prefer `rounded-lg` for cards and panels, `rounded-md` for buttons and inputs, `rounded-full` for icon badges.

## Component Conventions

### Buttons
- Primary: `bg-primary text-primary-foreground` → yellow background, dark text
- Ghost: transparent with `hover:bg-muted`
- Secondary: `bg-secondary text-secondary-foreground` → dark gray
- Keep padding tight: `px-3 py-1.5` or `px-4 py-2` — Zaymo buttons are compact
- Font weight: `font-medium`

### Inputs & Textareas
- Background: `bg-input` (`#2a2a28` dark, `#ececec` light)
- Border: `border-border`
- Focus ring: `ring-ring` (yellow)
- Placeholder: `text-muted-foreground`

### Cards & Panels
- Background: `bg-card`
- Border: `border border-border`
- Radius: `rounded-lg`
- No heavy drop shadows — Zaymo uses subtle `0 2px 8px rgba(0,0,0,0.08)` at most

### Badges
- Use `rounded-full` with tight padding (`px-1.5 py-0.5`)
- Default badge: `bg-secondary text-secondary-foreground`
- Accent badge: `bg-primary text-primary-foreground` (yellow)

### Separators / Dividers
- Color: `border-border` (`#41413e`)
- Keep thin (1px default)

## Visual Aesthetic

- **Dark-first:** the app defaults to dark mode. Design for dark first, light second.
- **High contrast:** yellow (`#def223`) on near-black (`#1a1a1a`) is the signature combination. Use it for the most important interactive element on any surface.
- **Minimal:** avoid heavy gradients, decorative shadows, or excessive color. Let whitespace and the yellow accent do the work.
- **Geometric:** prefer straight edges and small, consistent border-radii over highly rounded "bubble" UI.
- **Compact:** Zaymo UI is dense. Default to smaller text (`text-xs`, `text-sm`), tighter padding, and smaller icon sizes (`h-3.5 w-3.5`, `h-4 w-4`).
