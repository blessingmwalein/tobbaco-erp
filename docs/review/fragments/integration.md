The mock layer is shaped like the future API so that Phase 2 replaces `apps/web/src/mock/` with a typed client and the pages keep their shape. Each `mock/domain/*.ts` file is the specification for one NestJS module; each mock operation becomes a transactional service method with the same guard order (permission → status → prerequisites → mutation → audit).

| UI area | Mock operations (apps/web/src/mock/domain) | Future NestJS module / endpoints | Notes |
|---|---|---|---|
| Daily setup | `daily-setup.ts` | `sale-days` — `POST /sale-dates`, `PATCH /sale-dates/:id/activate`, `POST /start-of-day` | Posted SoD immutable; corrections via audited supervisor action (UQ-16) |
| TIMB imports | `timb.ts` | `timb` — `POST /imports` (multipart) → `ImportJob`; adapters per file type; idempotent on booking ref / file checksum | **Real encrypted-file adapter is separate and unimplemented (UQ-13)**; sample adapter stays for development |
| Growers / creditors / buyers | `timb.ts` (+ reference data) | `growers`, `creditors`, `buyers` | Bank details owner/source open (UQ-12) |
| Receiving | `receiving.ts` | `receiving`, `transporters`, `delivery-notes`, `bales` | Scale adapter interface supplies mass by scale barcode |
| Tickets | `tickets.ts` | `tickets` — allocate (unique constraint on barcode per season), print events, confirm | Barcode check algorithm pluggable (UQ-01); printer adapter |
| Floor summary | `floor-summary.ts` | `floor-summary` — scan in a transaction; completion creates summary + sale + batch atomically | Scanner adapter; duplicate detection is an addition (UQ-20) |
| Data capture, batches | `data-capture.ts`, `batches.ts` | `data-capture`, `batch-processing` | Per-field partial save semantics preserved |
| Sales / balancing | `sales.ts` | `sales`, `balancing` — `GET /sales/:id/balancing-preview`, `POST /sales/:id/balance` | Backend alone decides Balanced/Processed |
| Approvals | `approvals.ts` | `approvals` — generic request/decide with no self-approval | Triggers configurable (UQ-06) |
| Deductions | `stop-orders.ts` | `stop-orders`, `deductions` — decimal arithmetic in the database layer | **Rates/formulas must be supplied by Ethical/TIMB (UQ-05)**; processing order documented |
| Payments | `payments.ts` | `payments` — schedules, bank CSV, CloudPay adapter, reconciliation | Immutable `PaymentTransaction` history; paid only on verified confirmation |
| Dispatch | `dispatch.ts` | `dispatch` — notes, scans, post, cancel/reset, shipment export | Shipment file columns to be agreed (UQ-12) |
| Reports | `lib/reports/*` | `reports` — SQL read models, CSV/PDF generation, object storage | Print-to-PDF now, server PDF later |
| Admin / audit | `admin.ts` | `users`, `roles`, `permissions`, `settings`, `audit`, `organizations` | JWT + permission guards; audit written in the same transaction |
| Authentication | demo role picker | `auth` — JWT, refresh, permission claims | Phase 1 has **no real auth** |
| Search / notifications | `lib/search-index.ts`, notification ops | `GET /search`, `notifications` | Business references stay searchable |

**Cross-cutting for Phase 2:** UUID primary keys with human-readable document references; `numeric` for money/weights; unique constraints for barcodes, imports and payment schedules; idempotency keys on imports and payment submissions; soft deletion only where appropriate (never for posted records); Vercel-compatible serverless NestJS with pooled Neon connections; durable object storage for uploads.
