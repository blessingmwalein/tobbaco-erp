# ADR-0003 — Two application shells: back office and floor workspaces

- **Status:** Accepted
- **Date:** 2026-11-09

## Context
The manuals distinguish two kinds of screen: the **web interface** (purple bar, large fields, scanner-and-keyboard work on the floor) and the **back office** (menus for setup, checking, printing, processing). The brief (§3.5) says not to force everything into one CRUD layout.

## Decision
Two Next.js route groups with different shells:
- `(app)` back office: sidebar, top bar (breadcrumbs, global search, notification centre, user menu, demo role switcher), dense tables, role-aware navigation, charts.
- `(floor)` operational workspaces: minimal chrome, branded purple top bar, large auto-focused scan fields, keyboard-first (Enter submits, Tab navigates), focus returns after every scan, inline last-scan feedback (no modal per scan), running counts, scan history, optional beep, `aria-live` announcements.
- Back-office pages link to floor workspaces ("Open workspace") and vice versa; the same mock services back both.
- Floor workspaces: receiving (TDN + bales), ticket printing, floor summary, data capture, dispatch scanning.

## Consequences
+ Matches how clerks work; fast operation without distractions.
+ Shared design tokens keep both shells visually one product.
− Two layouts to maintain; shared components (scanner input, last-scan panel, status badges) live in `packages/ui`.

Sources: Overview ("Two kinds of screens"); brief Parts 3.4–3.5.
