import { Inject, Injectable } from "@nestjs/common";
import { AppError } from "../../common/app-error";
import { timestampRange } from "../../common/date-range";
import type { RequestMeta } from "../../common/decorators";
import type { BuyerPrincipal } from "../../common/principal";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { LedgerService, makeLedgerCtx } from "../ledger/ledger.service";

@Injectable()
export class MovementsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(LedgerService) private readonly ledger: LedgerService, @Inject(AuditService) private readonly audit: AuditService) {}

  list(p: BuyerPrincipal, q: { baleId?: string; warehouseId?: string; from?: string; to?: string }) {
    return this.prisma.forOrganisation(p.organisationId).baleMovement.findMany({
      where: { baleId: q.baleId, OR: q.warehouseId ? [{ fromWarehouseId: q.warehouseId }, { toWarehouseId: q.warehouseId }] : undefined, performedAt: timestampRange(q.from, q.to) },
      orderBy: { performedAt: "desc" }, take: 500,
      include: { bale: { select: { barcode: true, massKg: true, status: true } } },
    });
  }

  async move(p: BuyerPrincipal, b: { baleId?: string; barcode?: string; warehouseId: string; bayId?: string; rowId?: string; reason: string; note?: string }, m: RequestMeta) {
    return this.prisma.tenantTransaction(p.organisationId, async (tx) => {
      const bale = b.baleId ? await tx.bale.findUnique({ where: { id: b.baleId } }) : await tx.bale.findFirst({ where: { barcode: b.barcode } });
      if (!bale) throw AppError.notFound("Bale");
      const location = await this.ledger.resolveLocation(tx, { warehouseId: b.warehouseId, bayId: b.bayId, rowId: b.rowId });
      const result = await this.ledger.place(makeLedgerCtx(tx, p), bale.id, location, { reason: b.reason, note: b.note, ref: { type: "MANUAL", id: bale.id, label: "Manual movement" } });
      await this.audit.record(tx, p, { action: "warehouse.bale.moved", entityType: "Bale", entityId: bale.id, entityRef: bale.barcode, previous: { warehouseId: bale.currentWarehouseId, bayId: bale.currentBayId, rowId: bale.currentRowId }, next: { ...location, movement: result }, reason: b.reason, organisationId: p.organisationId }, m);
      return result;
    });
  }

  async reconcile(p: BuyerPrincipal) {
    return this.ledger.reconcileProjection(p.organisationId);
  }
}
