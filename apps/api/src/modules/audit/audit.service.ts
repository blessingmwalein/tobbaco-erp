import { Inject, Injectable } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { RequestMeta } from "../../common/decorators";
import type { Principal } from "../../common/principal";
import { PrismaService, type TenantTx } from "../../database/prisma.service";

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  entityRef?: string | null;
  previous?: unknown;
  next?: unknown;
  reason?: string | null;
  /** Organisation the action belongs to (auto-filled from a buyer principal). */
  organisationId?: string | null;
}

/** The base client, a `$transaction` client, or a tenant-scoped transaction client (AuditLog is not a tenant model). */
type Db = Pick<PrismaClient, "auditLog"> | Pick<TenantTx, "auditLog">;

/**
 * Audit trail. `record` accepts a transaction client so the audit row commits or rolls back TOGETHER with the change
 * it describes. The table is append-only (a DB trigger rejects UPDATE/DELETE).
 */
@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(db: Db | undefined, principal: Principal | null, entry: AuditEntry, meta: RequestMeta = {}): Promise<void> {
    const client = (db ?? this.prisma) as Pick<PrismaClient, "auditLog">;
    await client.auditLog.create({
      data: {
        principalType: principal?.type ?? null,
        principalId: principal?.id ?? null,
        principalName: principal?.name ?? null,
        buyerOrganisationId: entry.organisationId ?? (principal?.type === "BUYER" ? principal.organisationId : null),
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        entityRef: entry.entityRef ?? null,
        previous: (entry.previous ?? undefined) as Prisma.InputJsonValue | undefined,
        next: (entry.next ?? undefined) as Prisma.InputJsonValue | undefined,
        reason: entry.reason ?? null,
        ip: meta.ip ?? null,
        requestId: meta.requestId ?? null,
      },
    });
  }
}
