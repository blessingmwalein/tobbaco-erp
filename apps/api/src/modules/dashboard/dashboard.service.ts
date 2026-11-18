import { Inject, Injectable } from "@nestjs/common";
import { Prisma, type BuyerShipmentStatus } from "@prisma/client";
import type { BuyerDashboardDto, DashboardShipmentItem, DashboardShipmentStage } from "@tobacco/shared";
import type { DashboardQuery } from "@tobacco/validation";
import { businessDayStart, businessDaysBetween, dateColumnRange, timestampRange } from "../../common/date-range";
import { PrismaService } from "../../database/prisma.service";

const ZERO = new Prisma.Decimal(0);
const dec = (v: Prisma.Decimal | null | undefined, scale: number) => (v ?? ZERO).toFixed(scale);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const contains = (s: string) => ({ contains: s, mode: "insensitive" as const });

/** Shipment status -> the dashboard stage it belongs to. CANCELLED belongs to none. */
const STAGES = {
  inTransit: ["IN_TRANSIT"],
  arrived: ["ARRIVED"],
  receiving: ["RECEIVING", "RECONCILIATION_REQUIRED"],
  awaitingStorage: ["CONFIRMED", "STORAGE_IN_PROGRESS"],
} as const satisfies Record<string, readonly BuyerShipmentStatus[]>;
type StageKey = keyof typeof STAGES;

@Injectable()
export class DashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(organisationId: string, query: DashboardQuery, now = new Date()): Promise<BuyerDashboardDto> {
    const db = this.prisma.forOrganisation(organisationId);
    const saleDate = dateColumnRange(query.from, query.to);
    const floorOnPurchase = query.floor ? { floorName: contains(query.floor) } : {};

    // Purchases selected by sale date (+ floor). Purchase, receiving, levy and payable figures describe THESE purchases.
    const purchaseWhere: Prisma.PurchaseWhereInput = { ...(saleDate ? { saleDate } : {}), ...floorOnPurchase };
    const invoiceWhere: Prisma.BuyerInvoiceWhereInput = { ...(saleDate ? { saleDateTo: saleDate } : {}), ...floorOnPurchase };
    // Live position (shipments, sessions, exceptions, stock): the floor filter only.
    const livePurchase: Prisma.PurchaseWhereInput = floorOnPurchase;
    const inPurchases: Prisma.BaleWhereInput = { isProcessed: false, purchase: { is: purchaseWhere } };

    const stageRows = (key: StageKey) =>
      db.buyerShipment.findMany({
        where: { status: { in: [...STAGES[key]] }, ...(query.floor ? { purchase: { is: livePurchase } } : {}) },
        orderBy: [{ dispatchDate: "asc" }, { id: "asc" }],
        take: 5,
        include: { purchase: { select: { reference: true } } },
      });

    const [purchaseAgg, purchaseDates, receivedAgg, inWarehouses, unallocated, levies, payable, openSessionsCount, openExceptions, byStatus, completed, openSessionRows, recentPurchases, floorRows, ...stages] =
      await Promise.all([
        db.purchase.aggregate({ where: purchaseWhere, _count: { _all: true }, _sum: { totalBales: true, totalMassKg: true, totalUsdValue: true } }),
        db.purchase.aggregate({ where: purchaseWhere, _min: { saleDate: true }, _max: { saleDate: true } }),
        db.bale.aggregate({ where: { ...inPurchases, receivedAt: { not: null } }, _count: { _all: true }, _sum: { massKg: true } }),
        db.bale.count({ where: { status: { in: ["IN_STOCK", "RETURNED", "EXCEPTION"] }, currentWarehouseId: { not: null }, ...(query.floor ? { purchase: { is: livePurchase } } : {}) } }),
        db.bale.count({ where: { status: "IN_STOCK", currentWarehouseId: null, ...(query.floor ? { purchase: { is: livePurchase } } : {}) } }),
        // Section B holds the USD/ZiG split (a payment of the tobacco value) plus the levies and floor clearing: only the latter are "costs".
        db.invoiceCharge.aggregate({ where: { status: "B", code: { not: "CURRENCY_SPLIT" }, invoice: { is: invoiceWhere } }, _sum: { amountUsd: true, amountZig: true } }),
        db.buyerInvoice.aggregate({ where: invoiceWhere, _sum: { payableUsd: true, payableZig: true } }),
        db.receivingSession.count({ where: { status: "OPEN", ...(query.floor ? { purchase: { is: livePurchase } } : {}) } }),
        db.receivingException.count({ where: { status: "OPEN", ...(query.floor ? { session: { is: { purchase: { is: livePurchase } } } } : {}) } }),
        db.buyerShipment.groupBy({ by: ["status"], where: query.floor ? { purchase: { is: livePurchase } } : {}, _count: { _all: true }, _sum: { expectedBales: true, expectedMassKg: true } }),
        db.buyerShipment.aggregate({
          where: { status: "ALLOCATED", ...(timestampRange(query.from, query.to) ? { allocatedAt: timestampRange(query.from, query.to) } : {}), ...(query.floor ? { purchase: { is: livePurchase } } : {}) },
          _count: { _all: true },
          _sum: { expectedBales: true },
        }),
        db.receivingSession.findMany({
          where: { status: "OPEN", ...(query.floor ? { purchase: { is: livePurchase } } : {}) },
          orderBy: { startedAt: "desc" },
          take: 5,
          select: {
            id: true,
            reference: true,
            startedAt: true,
            purchase: { select: { reference: true, totalBales: true } },
            shipment: { select: { reference: true, expectedBales: true } },
            _count: { select: { scans: { where: { result: "RECEIVED", voidedAt: null } } } },
          },
        }),
        db.purchase.findMany({
          where: purchaseWhere,
          orderBy: [{ saleDate: "desc" }, { id: "asc" }],
          take: 5,
          select: { id: true, reference: true, floorName: true, saleDate: true, totalBales: true, totalUsdValue: true, receivingStatus: true },
        }),
        db.purchase.findMany({ distinct: ["floorName"], orderBy: { floorName: "asc" }, select: { floorName: true } }),
        stageRows("inTransit"),
        stageRows("arrived"),
        stageRows("receiving"),
        stageRows("awaitingStorage"),
      ]);

    // How many bales of each listed shipment have been received so far — one grouped query for all the lists.
    const listed = stages.flat();
    const receivedLines = listed.length
      ? await db.buyerShipmentBale.groupBy({ by: ["shipmentId"], where: { shipmentId: { in: listed.map((s) => s.id) }, status: { in: ["RECEIVED", "ALLOCATED"] } }, _count: { _all: true } })
      : [];
    const receivedBy = new Map(receivedLines.map((l) => [l.shipmentId, l._count._all]));

    const item = (s: (typeof listed)[number]): DashboardShipmentItem => ({
      id: s.id,
      reference: s.reference,
      purchaseReference: s.purchase.reference,
      truck: [s.truckRegistration, s.trailerRegistration].filter(Boolean).join(" / "),
      dispatchDate: ymd(s.dispatchDate),
      expectedArrivalAt: s.expectedArrivalAt?.toISOString() ?? null,
      arrivedAt: s.arrivedAt?.toISOString() ?? null,
      expectedBales: s.expectedBales,
      receivedBales: receivedBy.get(s.id) ?? 0,
      expectedMassKg: dec(s.expectedMassKg, 1),
      daysSinceDispatch: businessDaysBetween(businessDayStart(ymd(s.dispatchDate)), s.arrivedAt ?? now),
      status: s.status,
    });
    const stage = (key: StageKey, rows: typeof listed): DashboardShipmentStage => {
      const groups = byStatus.filter((g) => (STAGES[key] as readonly string[]).includes(g.status));
      return {
        count: groups.reduce((n, g) => n + g._count._all, 0),
        bales: groups.reduce((n, g) => n + (g._sum.expectedBales ?? 0), 0),
        massKg: dec(groups.reduce((m, g) => m.plus(g._sum.expectedMassKg ?? 0), ZERO), 1),
        items: rows.map(item),
      };
    };

    const purchasedBales = purchaseAgg._sum.totalBales ?? 0;
    return {
      filters: { from: query.from ?? null, to: query.to ?? null, floor: query.floor ?? null },
      floorOptions: floorRows.map((row) => row.floorName),
      period: { firstSaleDate: purchaseDates._min.saleDate ? ymd(purchaseDates._min.saleDate) : null, lastSaleDate: purchaseDates._max.saleDate ? ymd(purchaseDates._max.saleDate) : null },
      summary: {
        purchaseCount: purchaseAgg._count._all,
        purchasedBales,
        purchasedMassKg: dec(purchaseAgg._sum.totalMassKg, 1),
        totalSpendUsd: dec(purchaseAgg._sum.totalUsdValue, 2),
        receivedBales: receivedAgg._count._all,
        receivedMassKg: dec(receivedAgg._sum.massKg, 1),
        pendingReceiptBales: Math.max(0, purchasedBales - receivedAgg._count._all),
        inventoryBales: inWarehouses,
        unallocatedReceivedBales: unallocated,
        leviesUsd: dec(levies._sum.amountUsd, 2),
        leviesZig: dec(levies._sum.amountZig, 2),
        payableUsd: dec(payable._sum.payableUsd, 2),
        payableZig: dec(payable._sum.payableZig, 2),
        openReceivingSessions: openSessionsCount,
        openExceptions,
      },
      shipments: {
        inTransit: stage("inTransit", stages[0]!),
        arrived: stage("arrived", stages[1]!),
        receiving: stage("receiving", stages[2]!),
        awaitingStorage: stage("awaitingStorage", stages[3]!),
        completed: { count: completed._count._all, bales: completed._sum.expectedBales ?? 0 },
      },
      openSessions: openSessionRows.map((session) => ({
        id: session.id,
        reference: session.reference,
        startedAt: session.startedAt.toISOString(),
        purchaseReference: session.purchase.reference,
        shipmentReference: session.shipment?.reference ?? null,
        expectedBales: session.shipment?.expectedBales ?? session.purchase.totalBales,
        scannedBales: session._count.scans,
      })),
      recentPurchases: recentPurchases.map((p) => ({
        id: p.id,
        reference: p.reference,
        floorName: p.floorName,
        saleDate: ymd(p.saleDate),
        totalBales: p.totalBales,
        totalUsdValue: dec(p.totalUsdValue, 2),
        receivingStatus: p.receivingStatus,
      })),
    };
  }
}
