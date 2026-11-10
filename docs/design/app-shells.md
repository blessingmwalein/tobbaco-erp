# Application Shells

Two shells, one visual language (see ADR-0003). Both are desktop-first (large office monitors and floor workstations) and remain usable on tablets.

## 1. Back-office shell — route group `(app)`
Used for setup, imports, configuration, approvals, processing, finance and reporting (the legacy "back office" screens).

```
┌──────────────────────────────────────────────────────────────┐
│ BRAND      Breadcrumb            Search (⌘K)  Alerts  User ▾ │
├─────────────┬────────────────────────────────────────────────┤
│ SIDEBAR     │ Page heading · description · contextual actions│
│ Overview    │ KPI row                                        │
│ Sale Day    │ Tables / workflows / charts                    │
│ Growers     │                                                │
│ TIMB        │                                                │
│ Receiving   │                                                │
│ Tickets     │                                                │
│ Floor       │                                                │
│ Data        │                                                │
│ Finance     │                                                │
│ Dispatch    │                                                │
│ Reports     │                                                │
│ Settings    │                                                │
└─────────────┴────────────────────────────────────────────────┘
```
- Collapsible sidebar (248 px → 72 px) with active states and role-aware visibility.
- Top bar: breadcrumbs, global search (grower no., booking, TDN, GDN, scale/ticket barcode, sale, price/pay batch, dispatch ref), notification centre, user menu with **demo role switcher**, Reset Demo / scenario presets (demo-only, labelled).
- Page header: title, short description, contextual action area; sale-date and selling-point filters where relevant.
- Dense, scannable tables; detail pages with tabs; toasts and confirm dialogs for state changes.
- Floor-workspace deep links ("Open workspace") at stage pages (receiving, tickets, floor summary, data capture, dispatch).

## 2. Floor workspace shell — route group `(floor)`
Modernised version of the legacy purple-bar, large-field web interface for scanner-and-keyboard work.

```
┌────────────────────────────────────────────────────────────────┐
│ ▓ STATION NAME  · 17 Sep 2026 · EL Ethical Sales Floor · user ▓│  purple bar
├────────────────────────────────────────────────────────────────┤
│  CURRENT RECORD (grower · delivery · counts)      LAST SCAN    │
│  ┌──────────────────────────────┐  ┌────────────────────────┐  │
│  │  [ scan field – very large ] │  │ result / mass / group  │  │
│  └──────────────────────────────┘  └────────────────────────┘  │
│  Secondary fields (Tab order)  ·  Save (Enter)                 │
│  Running counts   ·   Scan history (right/bottom)              │
└────────────────────────────────────────────────────────────────┘
```
- Minimal navigation (back to hub, station switch, log out); no sidebar.
- Large auto-focused inputs; focus returns after every scan/save; Enter submits; Tab moves; shortcuts documented on screen.
- Immediate inline feedback (colour + icon + text, `aria-live`); **no modal per scan**.
- Visible progress ("Scanned 2 of 3", "Bale Tally 3 of 3 · Delivery Balanced").
- Fast record switching (grower/delivery selector at top).
- Honest device badges (scanner/scale/printer: SIMULATED).
- Workspaces: receiving (TDN + bales), ticket printing, floor summary (+ Check Floor Summary), data capture (Classification / e-Buying / All Details), dispatch scanning.

## Responsive behaviour
≥1280 px full layout; 768–1279 px sidebar collapses to icons, floor workspaces stack panels; below 768 px basic usability (tables scroll horizontally within cards, no page-level horizontal scroll).

Sources: Overview ("Two kinds of screens"); brief Part 3.4–3.5.
