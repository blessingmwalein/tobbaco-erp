import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { BuyerDashboardDto } from "@tobacco/shared";
import type { DashboardQuery } from "@tobacco/validation";
import { PrismaService } from "../../database/prisma.service";

const decimal = (value: Prisma.Decimal | null | undefined): string => value?.toString() ?? "0.00";

function nextDay(value: Date): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

@Injectable()
export class DashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(organisationId: string, query: DashboardQuery): Promise<BuyerDashboardDto> {
    const db = this.prisma.forOrganisation(organisationId);
    const purchaseDate = query.from || query.to ? {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lt: nextDay(query.to) } : {}),
    } : undefined;
    const dateTime = query.from || query.to ? {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lt: nextDay(query.to) } : {}),
    } : undefined;
    const purchaseWhere: Prisma.PurchaseWhereInput = {
      ...(purchaseDate ? { saleDate: purchaseDate } : {}),
      ...(query.floor ? { floorName: { contains: query.floor, mode: "insensitive" } } : {}),
    };
    const invoiceWhere: Prisma.BuyerInvoiceWhereInput = {
      ...(purchaseDate ? { saleDateFrom: purchaseDate } : {}),
      ...(query.floor ? { floorName: { contains: query.floor, mode: "insensitive" } } : {}),
    };
    const baleWhere: Prisma.BaleWhereInput = {
      ...(dateTime ? { receivedAt: dateTime } : {}),
      ...(query.floor ? { purchase: { floorName: { contains: query.floor, mode: "insensitive" } } } : {}),
    };
    const sessionWhere: Prisma.ReceivingSessionWhereInput = {
      status: "OPEN",
      ...(dateTime ? { startedAt: dateTime } : {}),
      ...(query.floor ? { purchase: { floorName: { contains: query.floor, mode: "insensitive" } } } : {}),
    };
    const exceptionWhere: Prisma.ReceivingExceptionWhereInput = {
      status: "OPEN",
      ...(dateTime ? { raisedAt: dateTime } : {}),
      ...(query.floor ? { session: { purchase: { floorName: { contains: query.floor, mode: "insensitive" } } } } : {}),
    };

    const [
      purchaseTotals,
      purchaseCount,
      receivedTotals,
      inventoryBales,
      chargeTotals,
      payableTotals,
      openReceivingSessions,
      openExceptions,
      openSessionRows,
      recentPurchases,
      floorRows,
    ] = await Promise.all([
      db.purchase.aggregate({ where: purchaseWhere, _sum: { totalBales: true, totalMassKg: true, totalUsdValue: true } }),
      db.purchase.count({ where: purchaseWhere }),
      db.bale.aggregate({ where: { ...baleWhere, receivedAt: { not: null, ...(dateTime ?? {}) } }, _count: { _all: true }, _sum: { massKg: true } }),
      db.bale.count({ where: { ...baleWhere, status: { in: ["IN_STOCK", "EXPECTED"] } } }),
      db.invoiceCharge.aggregate({ where: { invoice: { buyerOrganisationId: organisationId, ...invoiceWhere } }, _sum: { amountUsd: true, amountZig: true } }),
      db.buyerInvoice.aggregate({ where: invoiceWhere, _sum: { payableUsd: true, payableZig: true } }),
      db.receivingSession.count({ where: sessionWhere }),
      db.receivingException.count({ where: exceptionWhere }),
      db.receivingSession.findMany({
        where: sessionWhere,
        orderBy: { startedAt: "desc" },
        take: 5,
        select: { id: true, reference: true, startedAt: true, purchase: { select: { reference: true, totalBales: true } }, _count: { select: { scans: { where: { result: "RECEIVED" } } } } },
      }),
      db.purchase.findMany({ where: purchaseWhere, orderBy: { saleDate: "desc" }, take: 5, select: { id: true, reference: true, floorName: true, saleDate: true, totalBales: true, totalUsdValue: true, receivingStatus: true } }),
      db.purchase.findMany({ distinct: ["floorName"], orderBy: { floorName: "asc" }, select: { floorName: true } }),
    ]);

    return {
      filters: { from: query.from?.toISOString().slice(0, 10) ?? null, to: query.to?.toISOString().slice(0, 10) ?? null, floor: query.floor ?? null },
      floorOptions: floorRows.map((row) => row.floorName),
      summary: {
        purchasedBales: purchaseTotals._sum.totalBales ?? 0,
        purchasedMassKg: decimal(purchaseTotals._sum.totalMassKg),
        totalSpendUsd: decimal(purchaseTotals._sum.totalUsdValue),
        receivedBales: receivedTotals._count._all,
        receivedMassKg: decimal(receivedTotals._sum.massKg),
        inventoryBales,
        costsUsd: decimal(chargeTotals._sum.amountUsd),
        costsZig: decimal(chargeTotals._sum.amountZig),
        payableUsd: decimal(payableTotals._sum.payableUsd),
        payableZig: decimal(payableTotals._sum.payableZig),
        openReceivingSessions,
        openExceptions,
      },
      openSessions: openSessionRows.map((session) => ({
        id: session.id,
        reference: session.reference,
        startedAt: session.startedAt.toISOString(),
        purchaseReference: session.purchase.reference,
        expectedBales: session.purchase.totalBales,
        scannedBales: session._count.scans,
      })),
      recentPurchases: recentPurchases.map((purchase) => ({
        id: purchase.id,
        reference: purchase.reference,
        floorName: purchase.floorName,
        saleDate: purchase.saleDate.toISOString().slice(0, 10),
        totalBales: purchase.totalBales,
        totalUsdValue: purchase.totalUsdValue.toString(),
        receivingStatus: purchase.receivingStatus,
      })),
    };
  }
}
