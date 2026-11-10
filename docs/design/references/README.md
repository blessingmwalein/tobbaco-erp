# Visual references — drop the Dribbble shots here

The owner wants the Tobacco ERP to look and feel like these two shots (layout language, proportions, component styling, interaction patterns) **fused into our own design system**:

1. **Moverta TMS — Logistics Management Dashboard** — https://dribbble.com/shots/26670612-Moverta-TMS-Logistics-Management-Dashboard
2. **Truck&Co TMS — Logistics Management Dashboard** — https://dribbble.com/shots/26619200-Truck-Co-TMS-Logistics-Management-Dashboard

## Why this folder exists

Dribbble blocks automated access (an automated fetch returned HTTP 202 with an empty body on 2026-11-09, and a headless-browser attempt was refused as bot-check circumvention). We do not work around bot protection, and we never describe or imitate a design we have not seen. So the images must come from a person.

## What to save here

Open each shot in a browser, save the full-size image(s) (right-click → *Save image as…*; if a shot has several attachments, save all), and put them in this folder:

```
docs/design/references/
  moverta-tms-01.png      (add -02, -03 … for extra attachments)
  truckco-tms-01.png
```

Or paste/attach the images in the chat. Any format (PNG/JPG/WebP) is fine; larger is better.

## What happens next (design fusion)

1. Study every image and write `docs/design/reference-analysis.md`: sidebar width and collapsed state, top-bar height, content grid/max-width, card radius/border/shadow/padding, type scale and weights, KPI/number treatment, colour roles, chart styles (bars, lines, load/capacity bars), table density and header style, status chips, avatars, timelines / trip-progress visuals, floating panels, filters and form fields, icon style, spacing rhythm.
2. Produce a **token + component delta list** against the current baseline (`packages/design-system/src/theme.css`, `packages/ui`, the two shells) and apply it.
3. Map logistics concepts to tobacco-floor concepts: trip/load progress → delivery and bale progress; shipment status timeline → delivery-note and sale state timelines (Open → Tickets Printing → Checked → Laid; Draft → Balanced → Processed); floating map/detail panels → floor-row and sale-room panels.
4. Re-capture the review screenshots and add **side-by-side comparisons** to `docs/review/`.
5. The owner signs off on visual fidelity at the UI approval gate.

Not copied, ever: logos, brand names, illustrations, photos, copy text, or any asset. Layout language and styling only; all content is tobacco-floor operations.

## Current baseline (before the references are applied)

Built from the project brief's written direction only: off-white canvas (#F4F5F3), white rounded cards with thin neutral borders, restrained violet primary (#7201FF), lime (#8FFE01) as a fill for positive state, charcoal text, collapsible sidebar with a floating sale-day card, KPI tiles, a stage pipeline strip, purple floor-workspace bar with large scanner fields. It is expected to change once the references are studied.
