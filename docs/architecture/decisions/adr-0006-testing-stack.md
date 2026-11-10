# ADR-0006 — Testing stack

- **Status:** Accepted
- **Date:** 2026-11-09

## Context
The brief specifies Jest + Supertest for the backend, Playwright for end-to-end, and React Testing Library for UI interactions. Phase 1 has no backend. The frontend/shared packages are TypeScript ESM with Next.js and Vite-style tooling.

## Decision
- **Backend (Phase 2+):** Jest unit tests + Supertest API integration tests, as specified.
- **Frontend and shared packages (Phase 1):** **Vitest** with React Testing Library for domain/validation/state-transition tests and key UI interactions (scanner input, forms). Vitest is chosen over Jest for the web/shared packages because of faster TypeScript/ESM execution and zero-config alignment with the monorepo; **this is a deliberate deviation from "Jest everywhere"** — the brief names Jest only for backend unit tests. If the team prefers one runner, Jest can be used for the web too.
- **End-to-end:** Playwright with the documented 17 Sep 2026 journey; negative scenarios (invalid/duplicate scan, Start of Day blocked, tally mismatch, price mismatch, wrong-warehouse bale); role cases; `@axe-core/playwright` accessibility checks on key screens; keyboard-only and rapid-scan runs. Phase 1 e2e runs against the mock layer; Phase 7+ re-targets the real API with the same scenarios.
- Test data derives from the documented fixtures (`docs/research/demo-dataset.md`); verbatim messages come from the shared catalogue.
- Coverage priority: validators, state-transition guards, balancing preview, deduction ordering and the $173.11 reconciliation, role/permission enforcement.

## Consequences
+ Fast feedback; the same scenarios later verify the real backend.
− Two test runners across the repo (Vitest web/shared, Jest api); documented in CONTRIBUTING when `apps/api` is added.

Sources: brief Part 15.
