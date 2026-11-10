# Deployment Constraints (Vercel + Neon)

Documented before backend work, per the brief. Nothing here is built in Phase 1 (frontend on mock data); it constrains Phase 2+ design.

## Target
- **Frontend:** Next.js on Vercel.
- **API:** NestJS packaged as a Vercel-compatible Node.js serverless function (single modular monolith).
- **Database:** Neon PostgreSQL via Prisma.
- **Files:** durable object storage (e.g. Vercel Blob or S3-compatible) — never the serverless filesystem.
- **Background work:** Vercel Cron or an external worker; no persistent server processes.

## Constraints and design responses
| Constraint | Consequence | Design response |
|---|---|---|
| Serverless cold starts; no long-lived process | Nest bootstrap cost per cold start; no in-memory caches/jobs | Cache the Nest app instance across invocations; lazy-load heavy modules; keep module graph lean; no in-process schedulers |
| Execution time limits (function max duration depends on plan; verify at deployment time) | Large imports/reports may exceed a request | Chunked import jobs (UPLOADED → … states) resumable via cron/queue-less polling; report exports streamed or generated async and stored |
| Request/response body size limits | Large TIMB file uploads may not fit | Upload directly to object storage with a signed URL; API receives a file reference |
| Connection limits (many short-lived functions) | Prisma connection exhaustion on Postgres | Use Neon **pooled** connection string for runtime; direct (unpooled) URL for migrations only; keep Prisma client singleton; tune pool size; consider Prisma Accelerate/driver adapters if needed |
| Neon autosuspend/cold DB | First query latency | Acceptable for office hours; warm-up cron optional; retry with backoff on first connect |
| Ephemeral filesystem | Uploaded files, generated CSV/PDF vanish | Persist to object storage; store metadata (name, checksum, size) in DB |
| No sticky sessions | Auth must be stateless | JWT (short-lived access + refresh strategy), revocation list in DB if needed |
| Idempotency on retries | Serverless platforms retry/timeout | Idempotency keys on imports, schedules, processing runs, scans; unique constraints as the final guard |
| Secrets | Keys must not be in source | Vercel environment variables per environment; separate dev/preview/prod; TIMB keys and payment credentials in a secret store |
| Preview deployments | Must not touch production data or send payments | Separate Neon branches per preview; payment adapter forced to mock outside production |
| Observability | No log files on disk | Structured JSON logs to Vercel log drain; error tracking; request IDs; audit log in DB |
| Scheduled work | Needs cron endpoints protected | Vercel Cron hitting authenticated internal endpoints (secret header) for retries, cleanup, scheduled exports |
| Database migrations | Not run from serverless request path | Prisma migrate deploy in CI/CD against the direct URL |
| Backups | Neon point-in-time restore/branching | Document retention; export of critical tables; restore drill in Phase 12 |

## Open items to verify at Phase 2 start
Current Vercel function duration/size limits for the chosen plan; Prisma + Neon driver adapter recommendation at that time; object storage choice; whether the API is deployed as one function or a catch-all route handler; region closest to Zimbabwe users (latency to Neon region).

Sources: brief Parts 2.4, 12 (Phase 12), 14. (No manual content; platform facts to be re-verified at implementation.)
