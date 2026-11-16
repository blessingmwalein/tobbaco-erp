import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { FlowDiskHeader, FlowDiskImportDto, FlowDiskRow } from "@tobacco/shared";
import type { CreateFlowDiskImportInput, ConfirmFlowDiskImportInput } from "@tobacco/validation";
import { AppError } from "../../common/app-error";
import type { RequestMeta } from "../../common/decorators";
import type { BuyerPrincipal } from "../../common/principal";
import { PrismaService } from "../../database/prisma.service";
import { nextSequence, formatReference } from "../../common/reference";
import { AuditService } from "../audit/audit.service";
import { DocumentsService } from "../../storage/documents.service";
import { parseFlowDisk } from "./flowdisk.parser";

const dto = (row: any): FlowDiskImportDto => ({
  id: row.id, reference: row.reference, filename: row.filename, status: row.status,
  parserId: row.parserId, parserVersion: row.parserVersion, formatVerified: row.formatVerified,
  recordCount: row.recordCount, validCount: row.validCount,
  invalidCount: row.invalidCount, expectedMassKg: row.expectedMassKg.toString(),
  expectedUsdValue: row.expectedUsdValue.toString(), createdAt: row.createdAt.toISOString(),
});

@Injectable()
export class FlowdiskService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async stage(buyer: BuyerPrincipal, input: CreateFlowDiskImportInput, meta: RequestMeta) {
    let parsed;
    try { parsed = parseFlowDisk(input.filename, input.content); }
    catch (e) { throw AppError.unprocessable("INVALID_FLOW_DISK", e instanceof Error ? e.message : "The file could not be parsed"); }
    const hash = createHash("sha256").update(input.content).digest("hex");
    const db = this.prisma.forOrganisation(buyer.organisationId);
    const existing = await db.flowDiskImport.findFirst({ where: { fileSha256: hash, status: { in: ["STAGED", "COMPLETED"] } } });
    if (existing) throw AppError.conflict("DUPLICATE_IMPORT", "This Flow Disk file has already been imported", { importId: existing.id });
    const organisation = await this.prisma.buyerOrganisation.findUnique({ where: { id: buyer.organisationId }, select: { code: true, name: true } });
    if (!organisation) throw AppError.notFound("Buyer organisation");
    parsed.header = completeHeader(parsed.header, input.filename, organisation);
    const duplicateInvoice = /^\d{4}-\d{2}-\d{2}$/.test(parsed.header.saleDateFrom) && /^\d{4}-\d{2}-\d{2}$/.test(parsed.header.saleDateTo) ? await db.buyerInvoice.findFirst({
      where: {
        floorName: parsed.header.floorName,
        saleDateFrom: new Date(`${parsed.header.saleDateFrom}T00:00:00Z`),
        saleDateTo: new Date(`${parsed.header.saleDateTo}T00:00:00Z`),
        totalBales: parsed.rows.length,
        totalMassKg: parsed.totalMassKg,
        totalUsdValue: parsed.totalUsdValue,
      },
      select: { id: true, reference: true },
    }) : null;
    if (duplicateInvoice) throw AppError.conflict("DUPLICATE_INVOICE", `This file matches invoice ${duplicateInvoice.reference} already in the buyer ledger`, { invoiceId: duplicateInvoice.id });
    const doc = await this.documents.store({ organisationId: buyer.organisationId, kind: "FLOW_DISK", filename: input.filename, mimeType: "text/plain", data: Buffer.from(input.content), principal: buyer });
    const invalidRows = new Set(parsed.issues.map((i) => i.rowNumber));
    const reference = formatReference("FD", organisation.code, new Date().getFullYear(), await nextSequence(this.prisma, buyer.organisationId, `FD-${new Date().getFullYear()}`));
    const created = await this.prisma.tenantTransaction(buyer.organisationId, async (tx) => {
      const record = await tx.flowDiskImport.create({
        data: {
          buyerOrganisationId: buyer.organisationId, reference, filename: input.filename, parserId: parsed.parserId, parserVersion: parsed.parserVersion,
          formatVerified: parsed.formatVerified, fileSha256: hash, fileDocumentId: doc.id,
          header: parsed.header as unknown as Prisma.InputJsonValue, stagedRows: parsed.rows as unknown as Prisma.InputJsonValue,
          invoiceDraft: parsed.invoiceDraft as unknown as Prisma.InputJsonValue,
          recordCount: parsed.rows.length, validCount: parsed.rows.length - invalidRows.size, invalidCount: invalidRows.size,
          expectedMassKg: parsed.totalMassKg, expectedUsdValue: parsed.totalUsdValue, createdById: buyer.id,
          issues: { create: parsed.issues.map((i) => {
            const raw = parsed.rows.find((r) => r.rowNumber === i.rowNumber);
            return { rowNumber: i.rowNumber, kind: i.kind, field: i.field, message: i.message, ...(raw ? { raw: raw as unknown as Prisma.InputJsonValue } : {}) };
          }) },
        },
      });
      await this.audit.record(tx, buyer, { action: "flowdisk.staged", entityType: "FlowDiskImport", entityId: record.id, entityRef: reference, next: { filename: input.filename, recordCount: parsed.rows.length }, organisationId: buyer.organisationId }, meta);
      return record;
    }).catch((e) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw AppError.conflict("DUPLICATE_IMPORT", "This Flow Disk file has already been imported");
      throw e;
    });
    return { ...dto(created), header: parsed.header, rows: parsed.rows, issues: parsed.issues, invoiceDraft: parsed.invoiceDraft, totalMassKg: parsed.totalMassKg, totalUsdValue: parsed.totalUsdValue };
  }

  async list(buyer: BuyerPrincipal) {
    const rows = await this.prisma.forOrganisation(buyer.organisationId).flowDiskImport.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return rows.map(dto);
  }

  async get(buyer: BuyerPrincipal, id: string) {
    const row = await this.prisma.forOrganisation(buyer.organisationId).flowDiskImport.findUnique({ where: { id }, include: { issues: true } });
    if (!row) throw AppError.notFound("Flow Disk import");
    return { ...dto(row), header: row.header, rows: row.stagedRows, issues: row.issues, invoiceDraft: row.invoiceDraft };
  }

  async remove(buyer: BuyerPrincipal, id: string, meta: RequestMeta) {
    return this.prisma.tenantTransaction(buyer.organisationId, async (tx) => {
      const imp = await tx.flowDiskImport.findUnique({ where: { id } });
      if (!imp) throw AppError.notFound("Flow Disk import");
      if (imp.status !== "STAGED") throw AppError.conflict("IMPORT_COMPLETED", "Completed imports cannot be deleted because their invoice and bales are part of the buyer ledger");
      await this.audit.record(tx, buyer, { action: "flowdisk.deleted", entityType: "FlowDiskImport", entityId: id, entityRef: imp.reference, next: { filename: imp.filename }, organisationId: buyer.organisationId }, meta);
      await tx.flowDiskImport.delete({ where: { id } });
      return { id, deleted: true };
    });
  }

  async confirm(buyer: BuyerPrincipal, id: string, input: ConfirmFlowDiskImportInput, meta: RequestMeta) {
    return this.prisma.tenantTransaction(buyer.organisationId, async (tx) => {
      const imp = await tx.flowDiskImport.findUnique({ where: { id }, include: { issues: true } });
      if (!imp) throw AppError.notFound("Flow Disk import");
      if (imp.status !== "STAGED") throw AppError.conflict("IMPORT_NOT_STAGED", "Only a staged import can be confirmed");
      const rows = (input.correctedRows ?? imp.stagedRows) as unknown as FlowDiskRow[];
      const seen = new Set<string>();
      for (const [index, row] of rows.entries()) {
        if (!row.barcode || seen.has(row.barcode)) throw AppError.unprocessable("INVALID_IMPORT", `Duplicate or missing barcode at row ${index + 1}`);
        seen.add(row.barcode);
      }
      const alreadyExists = await tx.bale.findMany({ where: { barcode: { in: rows.map((r) => r.barcode) } }, select: { barcode: true } });
      if (alreadyExists.length) throw AppError.conflict("DUPLICATE_BALE", "One or more barcodes already exist in this buyer's inventory", { barcodes: alreadyExists.map((b) => b.barcode) });
      if (imp.issues.some((i) => i.severity === "ERROR") && !input.correctedRows) throw AppError.unprocessable("IMPORT_HAS_ERRORS", "Resolve all import errors before confirming");
      const organisation = await this.prisma.buyerOrganisation.findUniqueOrThrow({ where: { id: buyer.organisationId }, select: { code: true, name: true } });
      const header = completeHeader(imp.header as unknown as FlowDiskHeader, imp.filename, organisation);
      const invoiceDraft = (imp.invoiceDraft ?? null) as {
        preparedBy?: string | null;
        totalZigValue?: string | null;
        payableUsd?: string | null;
        payableZig?: string | null;
        charges?: Array<{ status: string; code: string; label: string; amountUsd: string; amountZig: string; sortOrder: number }>;
        gradeSummary?: Array<{ grade: string; bales: number; massKg: string; avgUsc: string; usdValue: string }>;
      } | null;
      if (!header.saleDateFrom || !header.saleDateTo || !/^\d{4}-\d{2}-\d{2}$/.test(header.saleDateFrom)) throw AppError.unprocessable("MISSING_INVOICE_FACTS", "Sale dates are required before confirmation");
      const year = Number(String(header.saleDateFrom).slice(0, 4));
      const invoiceRef = formatReference("BINV", organisation.code, year, await nextSequence(tx, buyer.organisationId, `BINV-${year}`));
      const purchaseRef = formatReference("PUR", organisation.code, year, await nextSequence(tx, buyer.organisationId, `PUR-${year}`));
      const totalMass = rows.reduce((n, r) => n + Number(r.massKg), 0).toFixed(1);
      const totalValue = rows.reduce((n, r) => n + Number(r.usdValue), 0).toFixed(2);
      const invoice = await tx.buyerInvoice.create({ data: {
        buyerOrganisationId: buyer.organisationId, reference: invoiceRef, company: organisation.name, floorName: header.floorName,
        buyerNameOnInvoice: header.buyerName, saleDateFrom: new Date(`${header.saleDateFrom}T00:00:00Z`), saleDateTo: new Date(`${header.saleDateTo}T00:00:00Z`),
        invoiceDate: new Date(`${header.saleDateTo}T00:00:00Z`), exchangeRate: header.exchangeRate ?? "0", totalBales: rows.length,
        totalMassKg: totalMass, avgUscPerKg: (rows.reduce((n, r) => n + Number(r.uscPerKg), 0) / rows.length).toFixed(2),
        totalUsdValue: totalValue, preparedBy: invoiceDraft?.preparedBy ?? null,
        totalZigValue: invoiceDraft?.totalZigValue ?? null, payableUsd: invoiceDraft?.payableUsd ?? null, payableZig: invoiceDraft?.payableZig ?? null,
        charges: invoiceDraft?.charges?.length ? { create: invoiceDraft.charges } : undefined,
        gradeSummary: invoiceDraft?.gradeSummary?.length ? { create: invoiceDraft.gradeSummary.map((summary) => ({ grade: summary.grade, bales: summary.bales, massKg: summary.massKg, avgUsc: summary.avgUsc, usdValue: summary.usdValue })) } : undefined,
      }});
      const purchase = await tx.purchase.create({ data: { buyerOrganisationId: buyer.organisationId, invoiceId: invoice.id, reference: purchaseRef, floorName: header.floorName, saleDate: new Date(`${header.saleDateTo}T00:00:00Z`), totalBales: rows.length, totalMassKg: totalMass, totalUsdValue: totalValue } });
      for (const row of rows) {
        const bale = await tx.bale.create({ data: { buyerOrganisationId: buyer.organisationId, purchaseId: purchase.id, barcode: row.barcode, season: year, buyerGrade: row.buyerGrade, timbGrade: row.timbGrade, growerNo: row.growerNo, lotNo: row.lotNo, massKg: row.massKg, uscPerKg: row.uscPerKg, usdValue: row.usdValue } });
        await tx.baleEvent.create({ data: { buyerOrganisationId: buyer.organisationId, baleId: bale.id, type: "IMPORTED", performedById: buyer.id, performedByName: buyer.name, refType: "FlowDiskImport", refId: imp.id, refLabel: imp.reference } });
      }
      const updated = await tx.flowDiskImport.update({ where: { id }, data: { status: "COMPLETED", stagedRows: rows as unknown as Prisma.InputJsonValue, recordCount: rows.length, validCount: rows.length, invalidCount: 0, confirmedById: buyer.id, confirmedAt: new Date(), invoiceId: invoice.id, purchaseId: purchase.id } });
      await this.audit.record(tx, buyer, { action: "flowdisk.confirmed", entityType: "FlowDiskImport", entityId: id, entityRef: imp.reference, next: { invoiceId: invoice.id, purchaseId: purchase.id, baleCount: rows.length }, organisationId: buyer.organisationId }, meta);
      return { import: dto(updated), invoiceId: invoice.id, purchaseId: purchase.id, invoiceReference: invoiceRef, purchaseReference: purchaseRef, baleCount: rows.length };
    });
  }
}

function completeHeader(
  header: FlowDiskHeader,
  filename: string,
  organisation: { code: string; name: string },
): FlowDiskHeader {
  const match = filename.match(/([A-Z0-9-]+)[_-](\d{4})(\d{2})(\d{2})/i);
  const inferredDate = match ? `${match[2]}-${match[3]}-${match[4]}` : "";
  return {
    floorName: header.floorName === "Unknown" ? "Flow Disk import" : header.floorName,
    buyerCode: header.buyerCode === "UNKNOWN" ? organisation.code : header.buyerCode,
    buyerName: header.buyerName === "Unknown" ? organisation.name : header.buyerName,
    saleDateFrom: header.saleDateFrom || inferredDate,
    saleDateTo: header.saleDateTo || inferredDate,
    exchangeRate: header.exchangeRate,
  };
}
