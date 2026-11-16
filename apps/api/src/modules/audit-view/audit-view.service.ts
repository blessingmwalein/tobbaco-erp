import { Inject, Injectable } from "@nestjs/common";
import type { AuditLogDto, Page } from "@tobacco/shared";
import type { AuditQuery } from "@tobacco/validation";
import { pageArgs, toPage } from "../../common/pagination";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class AuditViewService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(organisationId: string, q: AuditQuery): Promise<Page<AuditLogDto>> {
    const where = {
      buyerOrganisationId: organisationId,
      ...(q.action ? { action: q.action } : {}),
      ...(q.entityType ? { entityType: q.entityType } : {}),
      ...(q.entityId ? { entityId: q.entityId } : {}),
      ...(q.from || q.to ? { occurredAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], ...pageArgs(q) }),
      this.prisma.auditLog.count({ where }),
    ]);
    return toPage(rows.map((row) => ({
      id: row.id, occurredAt: row.occurredAt.toISOString(), principalType: row.principalType,
      principalId: row.principalId, principalName: row.principalName, action: row.action,
      entityType: row.entityType, entityId: row.entityId, entityRef: row.entityRef,
      previous: row.previous, next: row.next, reason: row.reason,
    })), total, q);
  }
}
