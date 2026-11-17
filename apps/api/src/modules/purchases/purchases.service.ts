import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { InvoiceQuery, PageQuery, PurchaseQuery } from "@tobacco/validation";
import { AppError } from "../../common/app-error";
import { orderBy, pageArgs, toPage } from "../../common/pagination";
import type { BuyerPrincipal } from "../../common/principal";
import { PrismaService } from "../../database/prisma.service";

const money = (v: Prisma.Decimal | null | undefined) => v?.toString() ?? null;
const purchaseDto = (p: any) => {
  const shipments = (p.shipments ?? []) as Array<{ expectedBales: number; expectedMassKg: Prisma.Decimal; bales: Array<{ status: string }> }>;
  const totalDispatchedBales = shipments.reduce((total, s) => total + s.expectedBales, 0);
  const totalReceivedBales = shipments.reduce((total, s) => total + s.bales.filter((b) => ["RECEIVED", "ALLOCATED"].includes(b.status)).length, 0);
  const totalAllocatedBales = shipments.reduce((total, s) => total + s.bales.filter((b) => b.status === "ALLOCATED").length, 0);
  const totalDispatchedMassKg = shipments.reduce((total, s) => total + Number(s.expectedMassKg ?? 0), 0);
  return {
    id: p.id, reference: p.reference, floorName: p.floorName, saleDate: p.saleDate.toISOString().slice(0, 10),
    totalBales: p.totalBales, totalMassKg: p.totalMassKg.toString(), totalUsdValue: p.totalUsdValue.toString(),
    receivingStatus: p.receivingStatus, invoiceId: p.invoiceId, createdAt: p.createdAt.toISOString(),
    invoiceNumber: p.invoice?.invoiceNumber ?? null,
    invoiceReference: p.invoice?.reference ?? null,
    buyerName: p.invoice?.buyerNameOnInvoice ?? p.invoice?.company ?? null,
    totalDispatchedBales,
    totalReceivedBales,
    totalAllocatedBales,
    totalDispatchedMassKg: totalDispatchedMassKg.toFixed(1),
    outstandingBales: Math.max(0, p.totalBales - totalReceivedBales),
    notYetDispatchedBales: Math.max(0, p.totalBales - totalDispatchedBales),
    shipmentCount: shipments.length,
    reconciliationStatus: p.reconciliation?.status ?? null,
    allocationComplete: totalAllocatedBales > 0 && totalAllocatedBales === p.totalBales,
  };
};
const invoiceDto = (i: any) => ({
  id: i.id, reference: i.reference, invoiceNumber: i.invoiceNumber, company: i.company, floorName: i.floorName,
  buyerNameOnInvoice: i.buyerNameOnInvoice, saleDateFrom: i.saleDateFrom.toISOString().slice(0, 10),
  saleDateTo: i.saleDateTo.toISOString().slice(0, 10), invoiceDate: i.invoiceDate.toISOString().slice(0, 10),
  exchangeRate: i.exchangeRate.toString(), totalBales: i.totalBales, totalMassKg: i.totalMassKg.toString(),
  avgUscPerKg: i.avgUscPerKg.toString(), totalUsdValue: i.totalUsdValue.toString(), totalZigValue: money(i.totalZigValue),
  splitUsdPercent: money(i.splitUsdPercent), payableUsd: money(i.payableUsd), payableZig: money(i.payableZig),
  documentId: i.documentId, charges: i.charges?.map((c: any) => ({ status: c.status, code: c.code, label: c.label, amountUsd: c.amountUsd.toString(), amountZig: c.amountZig.toString(), sortOrder: c.sortOrder })) ?? [],
  gradeSummary: i.gradeSummary?.map((g: any) => ({ grade: g.grade, bales: g.bales, massKg: g.massKg.toString(), avgUsc: g.avgUsc.toString(), usdValue: g.usdValue.toString() })) ?? [],
});

@Injectable()
export class PurchasesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listPurchases(buyer: BuyerPrincipal, q: PurchaseQuery) {
    const where: Prisma.PurchaseWhereInput = {
      ...(q.search ? { OR: [{ reference: { contains: q.search, mode: "insensitive" } }, { floorName: { contains: q.search, mode: "insensitive" } }] } : {}),
      ...(q.floor ? { floorName: { contains: q.floor, mode: "insensitive" } } : {}),
      ...(q.buyer ? { invoice: { OR: [{ buyerNameOnInvoice: { contains: q.buyer, mode: "insensitive" } }, { company: { contains: q.buyer, mode: "insensitive" } }] } } : {}),
      ...(q.invoiceNumber ? { invoice: { OR: [{ invoiceNumber: { contains: q.invoiceNumber, mode: "insensitive" } }, { reference: { contains: q.invoiceNumber, mode: "insensitive" } }] } } : {}),
      ...(q.status ? { receivingStatus: q.status } : {}),
      ...(q.reconciliationStatus ? { reconciliation: { status: q.reconciliationStatus } } : {}),
      ...(q.from || q.to ? { saleDate: { ...(q.from ? { gte: new Date(`${q.from}T00:00:00Z`) } : {}), ...(q.to ? { lte: new Date(`${q.to}T00:00:00Z`) } : {}) } } : {}),
    };
    const db = this.prisma.forOrganisation(buyer.organisationId);
    const [rows, total] = await Promise.all([
      db.purchase.findMany({ where, orderBy: orderBy(q, ["saleDate", "reference", "createdAt"] as const, "saleDate"), ...pageArgs(q), include: { invoice: { select: { invoiceNumber: true, reference: true, buyerNameOnInvoice: true, company: true } }, reconciliation: { select: { status: true } }, shipments: { select: { expectedBales: true, expectedMassKg: true, bales: { select: { status: true } } } } } }),
      db.purchase.count({ where }),
    ]);
    return toPage(rows.map(purchaseDto), total, q);
  }

  async getPurchase(buyer: BuyerPrincipal, id: string) {
    const p = await this.prisma.forOrganisation(buyer.organisationId).purchase.findUnique({
      where: { id },
      include: {
        invoice: true,
        reconciliation: { select: { id: true, status: true, closedAt: true, createdAt: true, updatedAt: true } },
        bales: { orderBy: { barcode: "asc" }, include: { shipmentBales: { include: { shipment: { select: { id: true, reference: true, status: true, dispatchDate: true } } } } } },
        shipments: { orderBy: { dispatchDate: "asc" }, include: { destinationWarehouse: { select: { id: true, code: true, name: true } }, bales: { select: { id: true, status: true, receivedAt: true, allocatedAt: true, bale: { select: { barcode: true } } } } } },
      },
    });
    if (!p) throw AppError.notFound("Purchase");
    const shipmentsById = new Map(p.shipments.map((s) => [s.id, s]));
    const baleLifecycle = p.bales.map((b: any) => {
      const line = (b.shipmentBales ?? [])[0] as { shipmentId: string; status: string; receivedAt?: string | null; allocatedAt?: string | null; shipment: { id: string; reference: string; status: string; dispatchDate: Date } } | undefined;
      let lifecycle = "NOT_DISPATCHED";
      let shipmentReference: string | null = null;
      let received = false;
      let allocated = false;
      if (line) {
        shipmentReference = line.shipment?.reference ?? null;
        if (line.status === "ALLOCATED") { lifecycle = "ALLOCATED"; allocated = true; received = true; }
        else if (line.status === "RECEIVED" || b.receivedAt) { lifecycle = "RECEIVED"; received = true; }
        else if (line.shipment?.status === "ARRIVED" || line.shipment?.status === "RECEIVING" || line.shipment?.status === "CONFIRMED") lifecycle = "ARRIVED_NOT_RECEIVED";
        else lifecycle = "IN_TRANSIT";
      }
      return this.baleDto(b, { lifecycle, shipmentReference, received, allocated });
    });
    const shipmentsDto = p.shipments.map((s: any) => ({
      id: s.id, reference: s.reference, dispatchDate: s.dispatchDate.toISOString().slice(0, 10),
      truckRegistration: s.truckRegistration, driverName: s.driverName,
      destinationWarehouse: s.destinationWarehouse ? { id: s.destinationWarehouse.id, code: s.destinationWarehouse.code, name: s.destinationWarehouse.name } : null,
      expectedBales: s.expectedBales, expectedMassKg: s.expectedMassKg.toString(),
      receivedBales: s.bales.filter((b: any) => ["RECEIVED", "ALLOCATED"].includes(b.status)).length,
      allocatedBales: s.bales.filter((b: any) => b.status === "ALLOCATED").length,
      status: s.status,
    }));
    return { ...purchaseDto(p), invoice: invoiceDto(p.invoice), reconciliation: p.reconciliation ? { id: p.reconciliation.id, status: p.reconciliation.status, closedAt: p.reconciliation.closedAt?.toISOString() ?? null, createdAt: p.reconciliation.createdAt.toISOString(), updatedAt: p.reconciliation.updatedAt.toISOString() } : null, shipments: shipmentsDto, bales: baleLifecycle };
  }

  async listBales(buyer: BuyerPrincipal, purchaseId: string, q: PageQuery) {
    const db = this.prisma.forOrganisation(buyer.organisationId);
    const where: Prisma.BaleWhereInput = { purchaseId, ...(q.search ? { OR: [{ barcode: { contains: q.search } }, { growerNo: { contains: q.search } }, { lotNo: { contains: q.search } }, { buyerGrade: { contains: q.search, mode: "insensitive" } }] } : {}) };
    const [rows, total] = await Promise.all([
      db.bale.findMany({ where, orderBy: orderBy(q, ["barcode", "growerNo", "lotNo", "massKg"] as const, "barcode"), ...pageArgs(q) }),
      db.bale.count({ where }),
    ]);
    return toPage(rows.map((b) => this.baleDto(b)), total, q);
  }

  async listInvoices(buyer: BuyerPrincipal, q: InvoiceQuery) {
    const where: Prisma.BuyerInvoiceWhereInput = {
      ...(q.search ? { OR: [{ reference: { contains: q.search, mode: "insensitive" } }, { buyerNameOnInvoice: { contains: q.search, mode: "insensitive" } }, { company: { contains: q.search, mode: "insensitive" } }] } : {}),
      ...(q.floor ? { floorName: { contains: q.floor, mode: "insensitive" } } : {}),
      ...(q.from || q.to ? { saleDateFrom: { ...(q.from ? { gte: new Date(`${q.from}T00:00:00Z`) } : {}), ...(q.to ? { lte: new Date(`${q.to}T00:00:00Z`) } : {}) } } : {}),
    };
    const db = this.prisma.forOrganisation(buyer.organisationId);
    const [rows, total] = await Promise.all([
      db.buyerInvoice.findMany({ where, orderBy: orderBy(q, ["invoiceDate", "reference", "createdAt"] as const, "invoiceDate"), ...pageArgs(q) }),
      db.buyerInvoice.count({ where }),
    ]);
    return toPage(rows.map(invoiceDto), total, q);
  }

  async getInvoice(buyer: BuyerPrincipal, id: string) {
    const i = await this.prisma.forOrganisation(buyer.organisationId).buyerInvoice.findUnique({ where: { id }, include: { charges: { orderBy: { sortOrder: "asc" } }, gradeSummary: true, purchase: { include: { bales: { orderBy: { barcode: "asc" } } } } } });
    if (!i) throw AppError.notFound("Invoice");
    return { ...invoiceDto(i), purchase: i.purchase ? { ...purchaseDto(i.purchase), bales: i.purchase.bales.map((b) => this.baleDto(b)) } : null };
  }

  private baleDto(b: any, lifecycle?: { lifecycle: string; shipmentReference: string | null; received: boolean; allocated: boolean }) {
    return { id: b.id, barcode: b.barcode, season: b.season, buyerGrade: b.buyerGrade, timbGrade: b.timbGrade, growerNo: b.growerNo, lotNo: b.lotNo, massKg: b.massKg.toString(), uscPerKg: b.uscPerKg.toString(), usdValue: b.usdValue.toString(), status: b.status, receivedAt: b.receivedAt?.toISOString() ?? null, currentWarehouseId: b.currentWarehouseId, currentBayId: b.currentBayId, currentRowId: b.currentRowId, ...(lifecycle ? { lifecycle: lifecycle.lifecycle, shipmentReference: lifecycle.shipmentReference, received: lifecycle.received, allocated: lifecycle.allocated } : {}) };
  }
}
