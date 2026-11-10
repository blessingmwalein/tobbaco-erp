# Design Tokens

Original design system for a premium enterprise product: minimal, clean, neutral, highly functional. Visual inspiration (not reproduction): the Moverta TMS and Truck&Co TMS Dribbble shots — layout proportions, sidebar/top navigation, card composition, spacing, rounded corners, status indicators, timelines. Tokens below are the brief's **starting values**, refined for accessibility. No gradients, no heavy shadows, no decorative illustrations, restrained purple primary, lime for positive indicators.

## Colour tokens (CSS custom properties)
```css
:root {
  --background: #F4F5F3;         /* soft off-white page */
  --surface: #FFFFFF;            /* cards, tables */
  --surface-secondary: #F8F8F6;  /* light grey secondary surface */
  --foreground: #171717;         /* dark charcoal text */
  --muted: #777D80;              /* brief value — see a11y note */
  --border: #E5E7E5;

  --primary: #7201FF;            /* restrained violet for primary actions */
  --primary-foreground: #FFFFFF;
  --success: #8FFE01;            /* lime — FILL / DOT ONLY */
  --warning: #E8A23B;            /* amber — fill/border; not for small text */
  --danger: #E5484D;             /* red — fill/border; large text/UI only */
  --neutral-dark: #202124;

  /* accessible text variants (added) */
  --muted-foreground: #5B6164;   /* small secondary text */
  --success-ink: #171717;        /* text on lime fill */
  --success-text: #2F6B00;       /* green text on light backgrounds */
  --warning-text: #8A5A00;
  --danger-text: #B42318;
}
```

## Accessibility notes (contrast, approximate — re-verify with tooling at implementation)
| Pair | Approx. contrast | Verdict | Rule |
|---|---|---|---|
| `#8FFE01` lime on white | ≈ 1.3 : 1 | **Fails** as text | Lime is **fill only** (badge/dot/progress) with charcoal `#171717` text on it (≈ 14 : 1). Use `--success-text #2F6B00` (≈ 6.5 : 1) for green text |
| `#7201FF` on white / white on `#7201FF` | ≈ 6.6 : 1 | Passes AA | Primary buttons/links OK |
| `#E8A23B` amber on white | ≈ 2.2 : 1 | Fails as small text | Fill/border only; text uses `--warning-text` (≈ 5.9 : 1) |
| `#E5484D` red on white | ≈ 3.9 : 1 | Large text/UI only | Small error text uses `--danger-text` (≈ 6.6 : 1) |
| `#777D80` muted on white / `#F4F5F3` | ≈ 4.2 / 3.8 : 1 | Below AA for small text | Small secondary text uses `--muted-foreground` (≈ 6.3 / 5.7 : 1) |
Status is never conveyed by colour alone: pair with icon and label. Focus ring: 2 px `--primary` offset, visible on all interactive elements. Dark mode deferred.

## Typography
Preferred: **Inter** (alternatives Geist, Manrope), loaded via `next/font`. Hierarchy: page title restrained (24–28 px, 600), section title 16–18 px (500–600), body 14 px, dense table text 13 px (accessible), labels 12 px medium in muted-foreground, numeric metrics 24–32 px with `tabular-nums`. Floor workspaces use larger scan inputs (28–36 px) and 16+ px body for glanceability.

## Spacing, radius, elevation
| Token | Value |
|---|---|
| Spacing scale | 4 px base: 4, 8, 12, 16, 20, 24, 32, 40, 48 |
| Radius | `--radius-sm` 8 px (inputs, badges), `--radius-md` 12 px (buttons, small cards), `--radius-lg` 16–20 px (cards, panels) — one consistent set |
| Borders | 1 px `--border` |
| Shadows | none by default; `0 1px 2px rgba(0,0,0,.04)` only on floating panels/popovers |
| Layout | Desktop-first; content max width fluid; sidebar 248 px (collapsed 72 px); responsive down to tablet |

## Status colour semantics
| Meaning | Fill | Text/icon |
|---|---|---|
| Positive / complete / Balanced / Posted | lime `--success` | `--success-ink` on fill |
| In progress / active stage | primary tint (`--primary` at ~10%) | `--primary` |
| Warning / awaiting / unverified | amber tint | `--warning-text` |
| Error / blocked / Draft-in-red (sales list) | red tint | `--danger-text` |
| Neutral / pending | `--surface-secondary` | `--muted-foreground` |
Special badges: **DEMO** (demo-only record), **UNVERIFIED** (rule/amount not confirmed — UQ-xx), **SIMULATED** (device/integration mock).

Sources: brief Part 3. The two Dribbble references have not been viewed yet (no screenshots were supplied); if they cannot be fetched at Phase 1 start, screenshots will be requested from the project owner.
