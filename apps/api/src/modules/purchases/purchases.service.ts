import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { InvoiceQuery, PageQuery, PurchaseQuery } from "@tobacco/validation";
import { AppError } from "../../common/app-error";
import { orderBy, pageArgs, toPage } from "../../common/pagination";
import type { BuyerPrincipal } from "../../common/principal";
import { PrismaService } from "../../database/prisma.service";

const money = (v: Prisma.Decimal | null | undefined) => v?.toString() ?? null;
const purchaseDto = (p: any) => ({
  id: p.id, reference: p.reference, floorName: p.floorName, saleDate: p.saleDate.toISOString().slice(0, 10),
  totalBales: p.totalBales, totalMassKg: p.totalMassKg.toString(), totalUsdValue: p.totalUsdValue.toString(),
  receivingStatus: p.receivingStatus, invoiceId: p.invoiceId, createdAt: p.createdAt.toISOString(),
});
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
      ...(q.status ? { receivingStatus: q.status } : {}),
      ...(q.from || q.to ? { saleDate: { ...(q.from ? { gte: new Date(`${q.from}T00:00:00Z`) } : {}), ...(q.to ? { lte: new Date(`${q.to}T00:00:00Z`) } : {}) } } : {}),
    };
    const db = this.prisma.forOrganisation(buyer.organisationId);
    const [rows, total] = await Promise.all([
      db.purchase.findMany({ where, orderBy: orderBy(q, ["saleDate", "reference", "createdAt"] as const, "saleDate"), ...pageArgs(q) }),
      db.purchase.count({ where }),
    ]);
    return toPage(rows.map(purchaseDto), total, q);
  }

  async getPurchase(buyer: BuyerPrincipal, id: string) {
    const p = await this.prisma.forOrganisation(buyer.organisationId).purchase.findUnique({ where: { id }, include: { invoice: true, bales: { orderBy: { barcode: "asc" } } } });
    if (!p) throw AppError.notFound("Purchase");
    return { ...purchaseDto(p), invoice: invoiceDto(p.invoice), bales: p.bales.map(this.baleDto) };
  }

  async listBales(buyer: BuyerPrincipal, purchaseId: string, q: PageQuery) {
    const db = this.prisma.forOrganisation(buyer.organisationId);
    const where: Prisma.BaleWhereInput = { purchaseId, ...(q.search ? { OR: [{ barcode: { contains: q.search } }, { growerNo: { contains: q.search } }, { lotNo: { contains: q.search } }, { buyerGrade: { contains: q.search, mode: "insensitive" } }] } : {}) };
    const [rows, total] = await Promise.all([
      db.bale.findMany({ where, orderBy: orderBy(q, ["barcode", "growerNo", "lotNo", "massKg"] as const, "barcode"), ...pageArgs(q) }),
      db.bale.count({ where }),
    ]);
    return toPage(rows.map(this.baleDto), total, q);
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
    return { ...invoiceDto(i), purchase: i.purchase ? { ...purchaseDto(i.purchase), bales: i.purchase.bales.map(this.baleDto) } : null };
  }

  private baleDto(b: any) {
    return { id: b.id, barcode: b.barcode, season: b.season, buyerGrade: b.buyerGrade, timbGrade: b.timbGrade, growerNo: b.growerNo, lotNo: b.lotNo, massKg: b.massKg.toString(), uscPerKg: b.uscPerKg.toString(), usdValue: b.usdValue.toString(), status: b.status, receivedAt: b.receivedAt?.toISOString() ?? null, currentWarehouseId: b.currentWarehouseId, currentBayId: b.currentBayId, currentRowId: b.currentRowId };
  }
}
