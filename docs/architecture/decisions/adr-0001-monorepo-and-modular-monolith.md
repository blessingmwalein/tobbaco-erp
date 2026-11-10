# ADR-0001 — Monorepo and modular monolith

- **Status:** Accepted
- **Date:** 2026-11-09

## Context
The brief requires a pnpm + Turborepo monorepo with `apps/web` (Next.js), later `apps/api` (NestJS), and shared `packages/*`. A previous sibling project used microservices with RabbitMQ and Redis; the brief explicitly forbids introducing distributed infrastructure without a documented requirement. The nine manuals describe a single-floor, single-database process with no cross-service messaging need.

## Decision
- One repository, pnpm workspaces + Turborepo. Phase 1 creates only `apps/web` and `packages/{ui,shared,validation,config,design-system}`; `apps/api` is created after UI approval.
- Backend is a **modular monolith**: one NestJS app, modules per business area owning their logic, DB access and endpoints; cross-module access through exported services only.
- No RabbitMQ, Kafka or Redis. Background work via Vercel Cron / external worker if required.
- Shared packages hold types, Zod validation, design tokens and UI primitives so backend and frontend can share contracts.

## Consequences
+ Simple deployment on Vercel (one API function), transactions across modules, easy testing.
+ Clear seams for later extraction if scale demands it.
− Modules must be disciplined (no cross-table writes); enforced by lint rules/review.
− Long-running or very large jobs need chunked design (see `deployment-constraints.md`).

Sources: brief Parts 2.1–2.4, 16.
