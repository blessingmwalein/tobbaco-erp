import { Inject, Injectable } from "@nestjs/common";
import { AppError } from "../../common/app-error";
import type { RequestMeta } from "../../common/decorators";
import type { BuyerPrincipal } from "../../common/principal";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class WarehousesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  list(p: BuyerPrincipal) {
    return this.prisma.forOrganisation(p.organisationId).warehouse.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { bays: true, bales: true } }, bays: { orderBy: { code: "asc" }, include: { _count: { select: { rows: true, bales: true } }, rows: { orderBy: { code: "asc" }, include: { _count: { select: { bales: true } } } } } } } });
  }
  async get(p: BuyerPrincipal, id: string) {
    const row = await this.prisma.forOrganisation(p.organisationId).warehouse.findUnique({ where: { id }, include: { bays: { include: { rows: true } } } });
    if (!row) throw AppError.notFound("Warehouse");
    return row;
  }
  async create(p: BuyerPrincipal, b: { code: string; name: string; kind?: "STANDARD" | "PROCESSING"; address?: string }, m: RequestMeta) {
    const row = await this.prisma.tenantTransaction(p.organisationId, async (tx) => {
      const created = await tx.warehouse.create({ data: { buyerOrganisationId: p.organisationId, code: b.code, name: b.name, kind: b.kind ?? "STANDARD", address: b.address ?? null } });
      await this.audit.record(tx, p, { action: "warehouse.created", entityType: "Warehouse", entityId: created.id, entityRef: created.code, next: b, organisationId: p.organisationId }, m);
      return created;
    });
    return row;
  }
  async update(p: BuyerPrincipal, id: string, b: { code?: string; name?: string; kind?: "STANDARD" | "PROCESSING"; address?: string; active?: boolean }, m: RequestMeta) {
    return this.prisma.tenantTransaction(p.organisationId, async (tx) => {
      const before = await tx.warehouse.findUnique({ where: { id } }); if (!before) throw AppError.notFound("Warehouse");
      const after = await tx.warehouse.update({ where: { id }, data: b });
      await this.audit.record(tx, p, { action: "warehouse.updated", entityType: "Warehouse", entityId: id, entityRef: before.code, previous: before, next: after, organisationId: p.organisationId }, m);
      return after;
    });
  }
  async createBay(p: BuyerPrincipal, warehouseId: string, b: { code: string; name?: string }, m: RequestMeta) {
    return this.prisma.tenantTransaction(p.organisationId, async (tx) => {
      const w = await tx.warehouse.findUnique({ where: { id: warehouseId } }); if (!w) throw AppError.notFound("Warehouse");
      const row = await tx.bay.create({ data: { buyerOrganisationId: p.organisationId, warehouseId, code: b.code, name: b.name ?? null } });
      await this.audit.record(tx, p, { action: "warehouse.bay.created", entityType: "Bay", entityId: row.id, entityRef: row.code, next: b, organisationId: p.organisationId }, m); return row;
    });
  }
  async createRow(p: BuyerPrincipal, bayId: string, b: { code: string; capacityBales?: number }, m: RequestMeta) {
    return this.prisma.tenantTransaction(p.organisationId, async (tx) => {
      const bay = await tx.bay.findUnique({ where: { id: bayId } }); if (!bay) throw AppError.notFound("Bay");
      const row = await tx.warehouseRow.create({ data: { buyerOrganisationId: p.organisationId, bayId, code: b.code, capacityBales: b.capacityBales ?? null } });
      await this.audit.record(tx, p, { action: "warehouse.row.created", entityType: "WarehouseRow", entityId: row.id, entityRef: row.code, next: b, organisationId: p.organisationId }, m); return row;
    });
  }
  async inventory(p: BuyerPrincipal, warehouseId: string, q: { status?: string; bayId?: string; rowId?: string; search?: string; from?: string; to?: string }) {
    const to = q.to ? new Date(`${q.to}T23:59:59.999Z`) : undefined;
    return this.prisma.forOrganisation(p.organisationId).bale.findMany({
      where: {
        currentWarehouseId: warehouseId,
        currentBayId: q.bayId,
        currentRowId: q.rowId,
        status: q.status as any,
        receivedAt: q.from || q.to ? { gte: q.from ? new Date(`${q.from}T00:00:00.000Z`) : undefined, lte: to } : undefined,
        OR: q.search ? [{ barcode: { contains: q.search } }, { growerNo: { contains: q.search, mode: "insensitive" } }, { lotNo: { contains: q.search, mode: "insensitive" } }] : undefined,
      },
      orderBy: { barcode: "asc" },
      select: { id: true, barcode: true, season: true, buyerGrade: true, timbGrade: true, growerNo: true, lotNo: true, massKg: true, usdValue: true, receivedAt: true, status: true, currentBayId: true, currentRowId: true },
    });
  }
}
