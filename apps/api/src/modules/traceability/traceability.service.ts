import { Inject, Injectable } from "@nestjs/common";
import type { BaleTimelineDto } from "@tobacco/shared";
import { AppError } from "../../common/app-error";
import { PrismaService } from "../../database/prisma.service";

const value = (v: unknown) => v instanceof Date ? v.toISOString() : v && typeof v === "object" && "toString" in v ? String(v) : v;
const clean = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, value(v)]));

@Injectable()
export class TraceabilityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async timeline(organisationId: string, barcode: string): Promise<BaleTimelineDto> {
    const db = this.prisma.forOrganisation(organisationId);
    const bale = await db.bale.findFirst({
      where: { barcode },
      include: {
        purchase: { select: { id: true, reference: true, saleDate: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        bay: { select: { id: true, code: true, name: true } },
        row: { select: { id: true, code: true } },
        events: { orderBy: [{ occurredAt: "asc" }, { id: "asc" }] },
        movements: { orderBy: [{ performedAt: "asc" }, { id: "asc" }] },
        scans: { orderBy: [{ scannedAt: "asc" }, { id: "asc" }] },
        lineageAsOriginal: true,
        lineageAsNew: true,
      },
    });
    if (!bale) throw AppError.notFound("Bale");
    const { events, movements, scans, lineageAsOriginal, lineageAsNew, ...details } = bale;
    const [currentWarehouse, currentBay, currentRow] = await Promise.all([
      details.currentWarehouseId ? db.warehouse.findUnique({ where: { id: details.currentWarehouseId }, select: { id: true, code: true, name: true } }) : null,
      details.currentBayId ? db.bay.findUnique({ where: { id: details.currentBayId }, select: { id: true, code: true, name: true } }) : null,
      details.currentRowId ? db.warehouseRow.findUnique({ where: { id: details.currentRowId }, select: { id: true, code: true } }) : null,
    ]);
    return {
      bale: {
        ...clean(details as unknown as Record<string, unknown>),
        currentLocation: {
          warehouse: currentWarehouse ? clean(currentWarehouse as unknown as Record<string, unknown>) : null,
          bay: currentBay ? clean(currentBay as unknown as Record<string, unknown>) : null,
          row: currentRow ? clean(currentRow as unknown as Record<string, unknown>) : null,
        },
      },
      events: events.map((e) => clean(e as unknown as Record<string, unknown>) as unknown as BaleTimelineDto["events"][number]),
      movements: movements.map((m) => clean(m as unknown as Record<string, unknown>)),
      scans: scans.map((s) => clean(s as unknown as Record<string, unknown>)),
      lineage: [...lineageAsOriginal, ...lineageAsNew].map((l) => clean(l as unknown as Record<string, unknown>)),
    };
  }
}
