import { Inject, Injectable } from "@nestjs/common";
import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb, RGB } from "pdf-lib";
import { AppError } from "../../common/app-error";
import type { RequestMeta } from "../../common/decorators";
import type { BuyerPrincipal } from "../../common/principal";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { LedgerService, makeLedgerCtx, type ResolvedLocation } from "../ledger/ledger.service";
import { buildBales, computeSummary } from "./reconciliation.aggregate";
import type { ReconciliationAllocateInput, ReconciliationQuery } from "@tobacco/validation";
import type {
  PurchaseReconciliationDto,
  ReconciliationBaleDto,
  ReconciliationListItemDto,
  ReconciliationReportDto,
  ReconciliationShipmentProgressDto,
  ReconciliationSummaryDto,
} from "@tobacco/shared";

@Injectable()
export class ReconciliationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(LedgerService) private readonly ledger: LedgerService,
  ) {}

  async list(actor: BuyerPrincipal, q: ReconciliationQuery) {
    const where: Record<string, unknown> = {};
    if (q.status) where.status = q.status;
    if (q.floor) where.purchase = { floorName: { contains: q.floor, mode: "insensitive" } };
    if (q.from || q.to) where.purchase = { ...(where.purchase as object), saleDate: { ...(q.from ? { gte: new Date(`${q.from}T00:00:00Z`) } : {}), ...(q.to ? { lte: new Date(`${q.to}T00:00:00Z`) } : {}) } };
    if (q.search) where.purchase = { ...(where.purchase as object), OR: [{ reference: { contains: q.search, mode: "insensitive" } }, { invoice: { invoiceNumber: { contains: q.search, mode: "insensitive" } } }, { invoice: { reference: { contains: q.search, mode: "insensitive" } } }] };
    const rows = await this.prisma.forOrganisation(actor.organisationId).purchaseReconciliation.findMany({
      where: where as any,
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: { purchase: { include: { invoice: { select: { invoiceNumber: true, reference: true, buyerNameOnInvoice: true, company: true } }, shipments: { select: { expectedBales: true, bales: { select: { status: true } } } } } } },
    });
    return rows.map((r: any) => {
      const shipments = r.purchase.shipments ?? [];
      const totalDispatched = shipments.reduce((t: number, s: any) => t + s.expectedBales, 0);
      const totalReceived = shipments.reduce((t: number, s: any) => t + s.bales.filter((b: any) => ["RECEIVED", "ALLOCATED"].includes(b.status)).length, 0);
      const totalAllocated = shipments.reduce((t: number, s: any) => t + s.bales.filter((b: any) => b.status === "ALLOCATED").length, 0);
      const item: ReconciliationListItemDto = {
        id: r.id, purchaseId: r.purchaseId, purchaseReference: r.purchase.reference,
        invoiceNumber: r.purchase.invoice?.invoiceNumber ?? null, buyerName: r.purchase.invoice?.buyerNameOnInvoice ?? r.purchase.invoice?.company ?? null,
        floorName: r.purchase.floorName, saleDate: r.purchase.saleDate.toISOString().slice(0, 10),
        status: r.status, totalPurchasedBales: r.purchase.totalBales, totalDispatchedBales: totalDispatched, totalReceivedBales: totalReceived,
        outstandingBales: Math.max(0, totalDispatched - totalReceived), shipmentCount: shipments.length,
        allocationComplete: totalAllocated > 0 && totalAllocated === r.purchase.totalBales,
        closedAt: r.closedAt?.toISOString() ?? null, updatedAt: r.updatedAt.toISOString(),
      };
      return item;
    });
  }

  /** Fetch everything needed to compute a purchase-level reconciliation in one pass. */
  private async loadPurchase(actor: BuyerPrincipal, purchaseId: string) {
    const purchase = await this.prisma.forOrganisation(actor.organisationId).purchase.findUnique({
      where: { id: purchaseId },
      include: {
        invoice: { select: { id: true, reference: true, invoiceNumber: true, buyerNameOnInvoice: true, company: true, floorName: true, saleDateTo: true } },
        reconciliation: true,
        bales: { orderBy: { barcode: "asc" }, select: { id: true, barcode: true, buyerGrade: true, timbGrade: true, growerNo: true, lotNo: true, massKg: true, uscPerKg: true, usdValue: true, status: true, receivedAt: true } },
        shipments: {
          orderBy: { dispatchDate: "asc" },
          include: {
            destinationWarehouse: { select: { id: true, code: true, name: true } },
            bales: { include: { bale: { select: { id: true, barcode: true, receivedAt: true } } } },
            sessions: { include: { scans: { select: { id: true, barcode: true, result: true, scannedAt: true } }, exceptions: { select: { id: true, barcode: true, kind: true, explanation: true, status: true, resolution: true } } } },
          },
        },
      },
    });
    if (!purchase) throw AppError.notFound("Purchase");
    return purchase;
  }

  private summarize(purchase: any, bales: ReconciliationBaleDto[]): { summary: ReconciliationSummaryDto; scans: any[]; exceptions: any[] } {
    const scans: any[] = [];
    const exceptions: any[] = [];
    for (const s of purchase.shipments ?? []) for (const sess of s.sessions ?? []) { scans.push(...(sess.scans ?? [])); exceptions.push(...(sess.exceptions ?? [])); }
    const summary = computeSummary(purchase, bales, scans, exceptions);
    summary.shipmentCount = (purchase.shipments ?? []).length;
    return { summary, scans, exceptions };
  }

  async get(actor: BuyerPrincipal, purchaseId: string): Promise<PurchaseReconciliationDto> {
    const purchase = await this.loadPurchase(actor, purchaseId);
    const { bales } = buildBales(purchase);
    const { summary, exceptions } = this.summarize(purchase, bales);
    const shipments: ReconciliationShipmentProgressDto[] = (purchase.shipments ?? []).map((s: any) => ({
      id: s.id, reference: s.reference, dispatchDate: s.dispatchDate.toISOString().slice(0, 10),
      truckRegistration: s.truckRegistration, driverName: s.driverName,
      destinationWarehouse: s.destinationWarehouse ? { id: s.destinationWarehouse.id, code: s.destinationWarehouse.code, name: s.destinationWarehouse.name } : null,
      expectedBales: s.expectedBales, receivedBales: (s.bales ?? []).filter((b: any) => ["RECEIVED", "ALLOCATED"].includes(b.status)).length,
      allocatedBales: (s.bales ?? []).filter((b: any) => b.status === "ALLOCATED").length, status: s.status,
    }));
    const reconciliation = purchase.reconciliation;
    const closedBy = reconciliation?.closedById ? await this.prisma.buyerUser.findUnique({ where: { id: reconciliation.closedById }, select: { name: true } }) : null;
    return {
      id: reconciliation?.id ?? "", purchaseId: purchase.id, purchaseReference: purchase.reference,
      invoiceId: purchase.invoice?.id ?? null, invoiceNumber: purchase.invoice?.invoiceNumber ?? null, invoiceReference: purchase.invoice?.reference ?? null,
      buyerName: purchase.invoice?.buyerNameOnInvoice ?? purchase.invoice?.company ?? null, floorName: purchase.floorName,
      saleDate: purchase.saleDate.toISOString().slice(0, 10),
      status: reconciliation?.status ?? "AWAITING_SHIPMENTS",
      summary, shipments, bales,
      allocationComplete: summary.totalAllocatedBales > 0 && summary.totalAllocatedBales === summary.totalPurchasedBales,
      closedAt: reconciliation?.closedAt?.toISOString() ?? null, closedByName: closedBy?.name ?? null,
      createdAt: reconciliation?.createdAt.toISOString() ?? purchase.createdAt.toISOString(),
      updatedAt: reconciliation?.updatedAt.toISOString() ?? purchase.createdAt.toISOString(),
    };
  }

  /** Close the purchase-level reconciliation. Allowed once every shipment is terminal, every purchased bale has been
   *  dispatched and received, and no receiving exceptions remain open. */
  async close(actor: BuyerPrincipal, purchaseId: string, input: { reason?: string }, meta: RequestMeta) {
    return this.prisma.tenantTransaction(actor.organisationId, async (tx) => {
      const reconciliation = await tx.purchaseReconciliation.findUnique({ where: { purchaseId }, include: { purchase: { include: { shipments: { include: { bales: true } } } } } });
      if (!reconciliation) throw AppError.notFound("Reconciliation");
      if (reconciliation.status === "CLOSED") throw AppError.conflict("RECONCILIATION_CLOSED", "This reconciliation is already closed");
      if (reconciliation.status === "AWAITING_SHIPMENTS") throw AppError.conflict("AWAITING_SHIPMENTS", "Import at least one shipment before reconciling");
      const shipments = reconciliation.purchase.shipments ?? [];
      const nonTerminal = shipments.filter((s: any) => !["CONFIRMED", "ALLOCATED", "CANCELLED"].includes(s.status));
      if (nonTerminal.length) throw AppError.conflict("SHIPMENTS_UNRESOLVED", `Resolve ${nonTerminal.length} shipment(s) still in transit or receiving before closing`);
      const dispatched = shipments.filter((s: any) => s.status !== "CANCELLED").reduce((t: number, s: any) => t + s.expectedBales, 0);
      if (dispatched < reconciliation.purchase.totalBales) throw AppError.conflict("PURCHASE_NOT_FULLY_DISPATCHED", "Every purchased bale must be dispatched before the reconciliation can close");
      const received = shipments.filter((s: any) => s.status !== "CANCELLED").reduce((t: number, s: any) => t + s.bales.filter((b: any) => ["RECEIVED", "ALLOCATED"].includes(b.status)).length, 0);
      if (received < reconciliation.purchase.totalBales) throw AppError.conflict("PURCHASE_NOT_FULLY_RECEIVED", "Every purchased bale must be physically received before the reconciliation can close");
      const sessionIds = shipments.flatMap((s: any) => (s.sessions ?? []).map((sess: any) => sess.id));
      const openExceptions = sessionIds.length ? await tx.receivingException.count({ where: { sessionId: { in: sessionIds }, status: "OPEN" } }) : 0;
      if (openExceptions) throw AppError.conflict("EXCEPTIONS_UNRESOLVED", "Resolve all receiving exceptions before closing the reconciliation");
      const full = await this.get(actor, purchaseId);
      const updated = await tx.purchaseReconciliation.update({ where: { id: reconciliation.id }, data: { status: "CLOSED", closedById: actor.id, closedAt: new Date(), snapshot: full as any } });
      await this.audit.record(tx, actor, { action: "reconciliation.closed", entityType: "PurchaseReconciliation", entityId: reconciliation.id, entityRef: reconciliation.purchase.reference, previous: { status: reconciliation.status }, next: { status: "CLOSED", reason: input.reason ?? null }, organisationId: actor.organisationId, reason: input.reason ?? null }, meta);
      return updated;
    });
  }

  /** Allocate every received-but-unallocated bale for a CLOSED reconciliation sequentially from a starting row. */
  async allocate(actor: BuyerPrincipal, purchaseId: string, input: ReconciliationAllocateInput, meta: RequestMeta) {
    return this.prisma.tenantTransaction(actor.organisationId, async (tx) => {
      const reconciliation = await tx.purchaseReconciliation.findUnique({ where: { purchaseId } });
      if (!reconciliation) throw AppError.notFound("Reconciliation");
      if (reconciliation.status !== "CLOSED") throw AppError.conflict("RECONCILIATION_NOT_CLOSED", "Close the reconciliation before allocating warehouse storage");
      const purchase = await tx.purchase.findUnique({ where: { id: purchaseId }, include: { shipments: { include: { bales: { include: { bale: true } } } } } });
      if (!purchase) throw AppError.notFound("Purchase");
      const lines = purchase.shipments.flatMap((s: any) => s.bales.map((b: any) => ({ shipmentId: s.id, shipment: s, line: b, bale: b.bale }))).filter((x: any) => x.line.status === "RECEIVED") as Array<{ shipmentId: string; shipment: any; line: any; bale: any }>;
      if (!lines.length) throw AppError.conflict("NOTHING_TO_ALLOCATE", "All received bales have already been allocated to storage");
      const warehouse = await tx.warehouse.findUnique({ where: { id: input.warehouseId }, include: { bays: { where: { id: input.bayId, active: true }, include: { rows: { where: { active: true }, orderBy: { code: "asc" } } } } } });
      const bay = warehouse?.bays[0];
      if (!warehouse || !bay || warehouse.kind !== "STANDARD") throw AppError.unprocessable("INVALID_LOCATION", "Select an active standard warehouse and bay");
      const startIndex = bay.rows.findIndex((row) => row.id === input.startingRowId);
      if (startIndex < 0) throw AppError.unprocessable("INVALID_LOCATION", "Select a starting row in the chosen bay");
      const rows = bay.rows.slice(startIndex);
      const ctx = makeLedgerCtx(tx, actor);
      const assignments: Array<{ baleId: string; rowId: string; lineId: string; shipmentId: string }> = [];
      let baleIndex = 0;
      for (const row of rows) {
        const occupied = await tx.bale.count({ where: { currentRowId: row.id, status: "IN_STOCK" } });
        const capacity = row.capacityBales ? Math.max(0, row.capacityBales - occupied) : lines.length;
        for (let slot = 0; slot < capacity && baleIndex < lines.length; slot += 1) {
          const target = lines[baleIndex++]!;
          assignments.push({ baleId: target.bale.id, rowId: row.id, lineId: target.line.id, shipmentId: target.shipmentId });
        }
        if (baleIndex === lines.length) break;
      }
      if (assignments.length !== lines.length) throw AppError.conflict("INSUFFICIENT_ROW_CAPACITY", "The selected starting row does not have enough capacity for the received bales");
      for (const assignment of assignments) {
        const location: ResolvedLocation = { warehouseId: warehouse.id, bayId: bay.id, rowId: assignment.rowId, kind: "STANDARD", label: `${warehouse.name} › ${bay.code} › ${rows.find((r) => r.id === assignment.rowId)!.code}` };
        await this.ledger.place(ctx, assignment.baleId, location, { reason: "Reconciliation storage allocation", ref: { type: "RECEIVING_SESSION", id: reconciliation.id, label: reconciliation.purchaseId } });
        await tx.buyerShipmentBale.update({ where: { id: assignment.lineId }, data: { status: "ALLOCATED", allocatedAt: new Date() } });
      }
      // Advance shipment + purchase progress.
      for (const shipment of purchase.shipments) {
        const all = await tx.buyerShipmentBale.count({ where: { shipmentId: shipment.id } });
        const allocated = await tx.buyerShipmentBale.count({ where: { shipmentId: shipment.id, status: "ALLOCATED" } });
        if (all > 0 && allocated === all) await tx.buyerShipment.update({ where: { id: shipment.id }, data: { status: "ALLOCATED", allocatedAt: new Date() } });
      }
      const totalAllocated = await tx.buyerShipmentBale.count({ where: { shipment: { purchaseId }, status: "ALLOCATED" } });
      await tx.purchase.update({ where: { id: purchaseId }, data: { receivingStatus: totalAllocated === purchase.totalBales ? "COMPLETE" : "PARTIALLY_RECEIVED" } });
      await this.audit.record(tx, actor, { action: "reconciliation.allocated", entityType: "PurchaseReconciliation", entityId: reconciliation.id, entityRef: purchase.reference, next: { allocatedBales: assignments.length, warehouseId: warehouse.id, bayId: bay.id, startingRowId: input.startingRowId }, organisationId: actor.organisationId }, meta);
      return { allocatedBales: assignments.length, purchaseId };
    });
  }

  /** Build the complete report payload used by every export format. */
  async buildReport(actor: BuyerPrincipal, purchaseId: string): Promise<ReconciliationReportDto> {
    const purchase = await this.loadPurchase(actor, purchaseId);
    const { bales, byBarcode } = buildBales(purchase);
    const { summary, scans, exceptions } = this.summarize(purchase, bales);
    const shipments: ReconciliationShipmentProgressDto[] = (purchase.shipments ?? []).map((s: any) => ({
      id: s.id, reference: s.reference, dispatchDate: s.dispatchDate.toISOString().slice(0, 10),
      truckRegistration: s.truckRegistration, driverName: s.driverName,
      destinationWarehouse: s.destinationWarehouse ? { id: s.destinationWarehouse.id, code: s.destinationWarehouse.code, name: s.destinationWarehouse.name } : null,
      expectedBales: s.expectedBales, receivedBales: (s.bales ?? []).filter((b: any) => ["RECEIVED", "ALLOCATED"].includes(b.status)).length,
      allocatedBales: (s.bales ?? []).filter((b: any) => b.status === "ALLOCATED").length, status: s.status,
    }));
    const missing = bales.filter((b) => b.discrepancy === "Flagged missing").map((b) => ({ barcode: b.barcode, growerNo: b.growerNo, lotNo: b.lotNo, massKg: b.massKg }));
    const unexpected = scans.filter((sc: any) => sc.result === "UNEXPECTED" || sc.result === "WRONG_BUYER" || sc.result === "WRONG_PURCHASE").map((sc: any) => ({ barcode: sc.barcode, note: sc.result }));
    const duplicates = scans.filter((sc: any) => sc.result === "DUPLICATE_SCAN").map((sc: any) => ({ barcode: sc.barcode, note: "Duplicate scan" }));
    const openEx = exceptions.filter((e: any) => e.status === "OPEN").map((e: any) => ({ id: e.id, barcode: e.barcode, kind: e.kind, explanation: e.explanation }));
    return {
      generatedAt: new Date().toISOString(),
      purchase: { reference: purchase.reference, invoiceNumber: purchase.invoice?.invoiceNumber ?? null, invoiceReference: purchase.invoice?.reference ?? null, buyerName: purchase.invoice?.buyerNameOnInvoice ?? purchase.invoice?.company ?? null, floorName: purchase.floorName, saleDate: purchase.saleDate.toISOString().slice(0, 10) },
      summary, shipments, bales,
      discrepancies: { missing, unexpected, duplicateScans: duplicates, openExceptions: openEx, resolvedExceptions: exceptions.filter((e: any) => e.status === "RESOLVED").length },
    };
  }

  async export(actor: BuyerPrincipal, purchaseId: string, format: "pdf" | "csv" | "json"): Promise<{ data: Buffer; filename: string; mimeType: string }> {
    const report = await this.buildReport(actor, purchaseId);
    const base = `reconciliation-${report.purchase.reference}`;
    if (format === "json") return { data: Buffer.from(JSON.stringify(report, null, 2), "utf8"), filename: `${base}.json`, mimeType: "application/json" };
    if (format === "csv") return { data: this.buildCsv(report), filename: `${base}.csv`, mimeType: "text/csv" };
    return { data: await this.buildPdf(report), filename: `${base}.pdf`, mimeType: "application/pdf" };
  }

  private buildCsv(report: ReconciliationReportDto): Buffer {
    const header = ["Barcode", "Buyer Grade", "TIMB Grade", "Grower", "Lot", "Mass Kg", "USc/kg", "USD Value", "Dispatched", "Shipment", "Received", "Received At", "Allocated", "Lifecycle", "Discrepancy"];
    const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [header.join(",")];
    for (const b of report.bales) lines.push([b.barcode, b.buyerGrade, b.timbGrade ?? "", b.growerNo, b.lotNo, b.massKg, b.uscPerKg, b.usdValue, b.dispatched ? "Yes" : "No", b.shipmentReference ?? "", b.received ? "Yes" : "No", b.receivedAt ?? "", b.allocated ? "Yes" : "No", b.lifecycle, b.discrepancy ?? ""].map(esc).join(","));
    lines.push("");
    lines.push(`Summary,,Purchased,${report.summary.totalPurchasedBales},Dispatched,${report.summary.totalDispatchedBales},Received,${report.summary.totalReceivedBales},Allocated,${report.summary.totalAllocatedBales},Outstanding,${report.summary.outstandingBales},Not yet dispatched,${report.summary.notYetDispatchedBales},Shipments,${report.summary.shipmentCount}`);
    lines.push(`Discrepancies,,Missing,${report.discrepancies.missing.length},Unexpected,${report.discrepancies.unexpected.length},Duplicate scans,${report.discrepancies.duplicateScans.length},Open exceptions,${report.discrepancies.openExceptions.length},Resolved exceptions,${report.discrepancies.resolvedExceptions}`);
    return Buffer.from(lines.join("\n"), "utf8");
  }

  private async buildPdf(report: ReconciliationReportDto): Promise<Buffer> {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    // ── Layout constants ────────────────────────────────────────────────────
    const W = 841.89, H = 595.28; // A4 landscape (pt)
    const ML = 36, MR = 36, MT = 36, MB = 36; // margins
    const BODY_W = W - ML - MR;
    const C_BLACK   = rgb(0,     0,     0);
    const C_DARK    = rgb(0.13,  0.13,  0.13);
    const C_MUTED   = rgb(0.45,  0.45,  0.45);
    const C_HEAD_BG = rgb(0.18,  0.24,  0.38); // dark navy header
    const C_HEAD_FG = rgb(1,     1,     1);
    const C_ROW_ALT = rgb(0.97,  0.97,  0.98);
    const C_RULE    = rgb(0.82,  0.82,  0.85);
    const C_PILL_OK = rgb(0.13,  0.57,  0.33); // green
    const C_PILL_WN = rgb(0.76,  0.49,  0.06); // amber
    const C_PILL_NG = rgb(0.76,  0.18,  0.18); // red
    const C_SECTION = rgb(0.24,  0.33,  0.52); // section heading colour
    const C_STRIPE  = rgb(0.93,  0.95,  1.00); // light blue stripe for KPI pairs

    // ── State shared across pages ───────────────────────────────────────────
    let page: PDFPage;
    let y: number;

    const newPage = () => {
      page = pdf.addPage([W, H]);
      y = H - MT;
    };
    newPage();

    // ── Low-level helpers ───────────────────────────────────────────────────
    const ensureSpace = (needed: number) => {
      if (y - needed < MB) newPage();
    };

    const text = (t: string, x: number, ty: number, size: number, f: PDFFont, colour: RGB = C_DARK) => {
      page.drawText(t, { x, y: ty, size, font: f, color: colour });
    };

    const hLine = (ty: number, x1 = ML, x2 = W - MR, colour: RGB = C_RULE, thickness = 0.4) => {
      page.drawLine({ start: { x: x1, y: ty }, end: { x: x2, y: ty }, thickness, color: colour });
    };

    const rect = (rx: number, ry: number, rw: number, rh: number, fill: RGB, stroke?: RGB) => {
      page.drawRectangle({ x: rx, y: ry, width: rw, height: rh, color: fill, ...(stroke ? { borderColor: stroke, borderWidth: 0.4 } : {}) });
    };

    const pill = (label: string, px: number, py: number, colour: RGB) => {
      const pw = font.widthOfTextAtSize(label, 7) + 8;
      const ph = 11;
      rect(px, py - 1, pw, ph, colour);
      text(label, px + 4, py + 1.5, 7, font, C_HEAD_FG);
      return pw + 4;
    };

    // ── Section heading ─────────────────────────────────────────────────────
    const sectionHeading = (title: string, extraY = 10) => {
      ensureSpace(28);
      y -= extraY;
      text(title.toUpperCase(), ML, y, 8, bold, C_SECTION);
      y -= 4;
      hLine(y, ML, W - MR, C_SECTION, 1);
      y -= 8;
    };

    // ── KPI grid ────────────────────────────────────────────────────────────
    const kpiGrid = (items: Array<{ label: string; value: string | number }>, cols = 6) => {
      const cellW = BODY_W / cols;
      const cellH = 34;
      ensureSpace(cellH + 4);
      const startY = y;
      items.forEach((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        if (col === 0 && row > 0) { /* handled by startY offset below */ }
        const cx = ML + col * cellW;
        const cy = startY - row * (cellH + 2);
        const bg = i % 2 === 0 ? C_STRIPE : rgb(0.99, 0.99, 1);
        rect(cx, cy - cellH, cellW - 2, cellH, bg, C_RULE);
        text(String(item.value), cx + 6, cy - 15, 14, bold, C_DARK);
        text(item.label, cx + 6, cy - cellH + 7, 7, font, C_MUTED);
      });
      const rows = Math.ceil(items.length / cols);
      y = startY - rows * (cellH + 2) - 6;
    };

    // ── Generic ruled table ─────────────────────────────────────────────────
    type Col = { header: string; width: number; align?: "left" | "right" | "center" };
    const drawTable = (cols: Col[], rows: string[][], rowH = 16) => {
      const totalW = cols.reduce((s, c) => s + c.width, 0);
      const headerH = rowH + 4;

      const drawHeader = () => {
        ensureSpace(headerH + rowH);
        rect(ML, y - headerH, totalW, headerH, C_HEAD_BG);
        let cx = ML;
        for (const col of cols) {
          const tw = font.widthOfTextAtSize(col.header, 7.5);
          const tx = col.align === "right" ? cx + col.width - tw - 5 : col.align === "center" ? cx + (col.width - tw) / 2 : cx + 5;
          text(col.header, tx, y - headerH + 5, 7.5, bold, C_HEAD_FG);
          cx += col.width;
        }
        y -= headerH;
      };

      drawHeader();
      let rowColour = false;

      for (const row of rows) {
        ensureSpace(rowH + 2);
        // If we flowed to a new page, re-draw the header
        const beforeY = y;
        if (y === H - MT) { drawHeader(); }
        // alternating row background
        if (rowColour) rect(ML, y - rowH, totalW, rowH, C_ROW_ALT);
        rowColour = !rowColour;
        // bottom rule
        hLine(y - rowH, ML, ML + totalW);
        // cells
        let cx = ML;
        for (let ci = 0; ci < cols.length; ci++) {
          const col = cols[ci]!;
          const cell = row[ci] ?? "";
          const size = 7.5;
          const tw = font.widthOfTextAtSize(cell, size);
          // clip text to column width
          let display = cell;
          while (display.length > 1 && font.widthOfTextAtSize(display + "...", size) > col.width - 10) display = display.slice(0, -1);
          if (display !== cell) display += "...";
          const tx = col.align === "right" ? cx + col.width - font.widthOfTextAtSize(display, size) - 5 : col.align === "center" ? cx + (col.width - font.widthOfTextAtSize(display, size)) / 2 : cx + 5;
          text(display, tx, y - rowH + 4, size, font, C_DARK);
          cx += col.width;
        }
        y -= rowH;
      }
      // closing bottom border
      hLine(y, ML, ML + totalW, C_RULE, 0.6);
      y -= 4;
    };

    // ── Lifecycle pill helper ───────────────────────────────────────────────
    const lifecyclePillColour = (lc: string): RGB => {
      if (lc === "ALLOCATED" || lc === "RECEIVED") return C_PILL_OK;
      if (lc === "IN_TRANSIT" || lc === "ARRIVED_NOT_RECEIVED") return C_PILL_WN;
      return C_MUTED;
    };
    const statusPillColour = (st: string): RGB => {
      if (["ALLOCATED", "CONFIRMED"].includes(st)) return C_PILL_OK;
      if (["IN_TRANSIT", "ARRIVED", "RECEIVING", "RECONCILIATION_REQUIRED"].includes(st)) return C_PILL_WN;
      if (["CANCELLED"].includes(st)) return C_PILL_NG;
      return C_MUTED;
    };
    const fmtLifecycle = (lc: string) => lc.replace(/_/g, " ");
    const fmtStatus    = (st: string) => st.replace(/_/g, " ");

    // ════════════════════════════════════════════════════════════════════════
    // PAGE 1 — Cover header
    // ════════════════════════════════════════════════════════════════════════
    rect(0, H - 70, W, 70, C_HEAD_BG);
    text("PURCHASE RECONCILIATION REPORT", ML, H - 26, 18, bold, C_HEAD_FG);
    text(`Generated ${new Date(report.generatedAt).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}`, ML, H - 44, 9, font, rgb(0.75, 0.80, 0.90));
    // right-side: status pill
    const recStatus = report.summary.openExceptions > 0 || report.summary.missingBales > 0 ? "DISCREPANCIES" : report.summary.outstandingBales > 0 ? "IN PROGRESS" : "COMPLETE";
    const recColour = recStatus === "COMPLETE" ? C_PILL_OK : recStatus === "IN PROGRESS" ? C_PILL_WN : C_PILL_NG;
    const sPillW = font.widthOfTextAtSize(recStatus, 9) + 20;
    rect(W - MR - sPillW, H - 50, sPillW, 20, recColour);
    text(recStatus, W - MR - sPillW + 10, H - 44, 9, bold, C_HEAD_FG);

    y = H - 70 - 18;

    // ── Purchase details bar ────────────────────────────────────────────────
    const p = report.purchase;
    const metaItems: Array<{ label: string; value: string }> = [
      { label: "Purchase reference", value: p.reference },
      { label: "Invoice",            value: p.invoiceNumber ?? p.invoiceReference ?? "-" },
      { label: "Buyer",              value: p.buyerName ?? "-" },
      { label: "Auction floor",      value: p.floorName },
      { label: "Sale date",          value: p.saleDate },
    ];
    const metaCellW = BODY_W / metaItems.length;
    rect(ML, y - 44, BODY_W, 44, rgb(0.96, 0.97, 1), C_RULE);
    metaItems.forEach((item, i) => {
      const cx = ML + i * metaCellW;
      text(item.label.toUpperCase(), cx + 8, y - 12, 6.5, font, C_MUTED);
      text(item.value, cx + 8, y - 28, 9, bold, C_DARK);
    });
    y -= 44 + 16;

    // ── Summary KPIs ────────────────────────────────────────────────────────
    sectionHeading("Summary", 4);
    const s = report.summary;
    kpiGrid([
      { label: "Purchased bales",        value: s.totalPurchasedBales   },
      { label: "Purchased mass (kg)",     value: s.totalPurchasedMassKg  },
      { label: "Dispatched bales",        value: s.totalDispatchedBales  },
      { label: "Received bales",          value: s.totalReceivedBales    },
      { label: "Allocated bales",         value: s.totalAllocatedBales   },
      { label: "Shipments",               value: s.shipmentCount         },
      { label: "Outstanding (disp-recv)", value: s.outstandingBales      },
      { label: "Not yet dispatched",      value: s.notYetDispatchedBales },
      { label: "Missing bales",           value: s.missingBales          },
      { label: "Unexpected scans",        value: s.unexpectedBales       },
      { label: "Duplicate scans",         value: s.duplicateScans        },
      { label: "Open exceptions",         value: s.openExceptions        },
    ], 6);

    // ── Shipments table ─────────────────────────────────────────────────────
    sectionHeading("Shipments");
    const shipCols: Col[] = [
      { header: "Reference",       width: 110 },
      { header: "Dispatch date",   width: 80  },
      { header: "Truck",           width: 90  },
      { header: "Driver",          width: 100 },
      { header: "Warehouse",       width: 105 },
      { header: "Expected",        width: 60,  align: "right" },
      { header: "Received",        width: 60,  align: "right" },
      { header: "Allocated",       width: 60,  align: "right" },
      { header: "Status",          width: 100 },
    ];
    // Status column is text; we render pills separately after the table
    const shipRows = report.shipments.map((sh) => [
      sh.reference,
      sh.dispatchDate,
      sh.truckRegistration,
      sh.driverName ?? "-",
      sh.destinationWarehouse?.name ?? "-",
      String(sh.expectedBales),
      String(sh.receivedBales),
      String(sh.allocatedBales),
      fmtStatus(sh.status),
    ]);
    drawTable(shipCols, shipRows, 18);

    // ── Bale-level comparison ───────────────────────────────────────────────
    sectionHeading("Bale-level comparison");
    const baleCols: Col[] = [
      { header: "Barcode",      width: 85  },
      { header: "Grade",        width: 60  },
      { header: "TIMB grade",   width: 60  },
      { header: "Grower",       width: 65  },
      { header: "Lot",          width: 40  },
      { header: "Mass (kg)",    width: 55,  align: "right" },
      { header: "USc/kg",       width: 50,  align: "right" },
      { header: "USD value",    width: 58,  align: "right" },
      { header: "Dispatched",   width: 56,  align: "center" },
      { header: "Received",     width: 54,  align: "center" },
      { header: "Shipment",     width: 90  },
      { header: "Lifecycle",    width: 108 },
    ];
    const baleRows = report.bales.map((b) => [
      b.barcode,
      b.buyerGrade,
      b.timbGrade ?? "-",
      b.growerNo,
      b.lotNo,
      b.massKg,
      b.uscPerKg,
      b.usdValue,
      b.dispatched ? "Y" : "-",
      b.received   ? "Y" : "-",
      b.shipmentReference ?? "-",
      fmtLifecycle(b.lifecycle) + (b.discrepancy ? ` (${b.discrepancy})` : ""),
    ]);
    drawTable(baleCols, baleRows, 15);

    // ── Discrepancies ───────────────────────────────────────────────────────
    const disc = report.discrepancies;
    const hasDiscrepancies = disc.missing.length || disc.unexpected.length || disc.duplicateScans.length || disc.openExceptions.length;
    sectionHeading("Discrepancies");

    // Summary pill row
    ensureSpace(24);
    let px = ML;
    px += pill(`Missing: ${disc.missing.length}`,           px, y - 14, disc.missing.length           ? C_PILL_NG : C_MUTED) + 4;
    px += pill(`Unexpected: ${disc.unexpected.length}`,     px, y - 14, disc.unexpected.length         ? C_PILL_NG : C_MUTED) + 4;
    px += pill(`Duplicate scans: ${disc.duplicateScans.length}`, px, y - 14, disc.duplicateScans.length ? C_PILL_WN : C_MUTED) + 4;
    px += pill(`Open exceptions: ${disc.openExceptions.length}`, px, y - 14, disc.openExceptions.length ? C_PILL_NG : C_MUTED) + 4;
    pill(`Resolved exceptions: ${disc.resolvedExceptions}`, px, y - 14, disc.resolvedExceptions        ? C_PILL_OK : C_MUTED);
    y -= 28;

    if (!hasDiscrepancies) {
      ensureSpace(22);
      rect(ML, y - 20, BODY_W, 20, rgb(0.92, 1, 0.94), C_RULE);
      text("All clear - no discrepancies. All purchased bales dispatched, received and accounted for.", ML + 10, y - 13, 8.5, font, C_PILL_OK);
      y -= 26;
    } else {
      if (disc.missing.length) {
        y -= 8;
        text("MISSING BALES", ML, y, 7.5, bold, C_PILL_NG);
        y -= 10;
        drawTable(
          [{ header: "Barcode", width: 100 }, { header: "Grower", width: 80 }, { header: "Lot", width: 55 }, { header: "Mass (kg)", width: 70, align: "right" }],
          disc.missing.map((m) => [m.barcode, m.growerNo, m.lotNo, m.massKg]),
          15,
        );
      }
      if (disc.unexpected.length) {
        y -= 8;
        text("UNEXPECTED BALES", ML, y, 7.5, bold, C_PILL_NG);
        y -= 10;
        drawTable(
          [{ header: "Barcode", width: 110 }, { header: "Note", width: 220 }],
          disc.unexpected.map((u) => [u.barcode, u.note]),
          15,
        );
      }
      if (disc.duplicateScans.length) {
        y -= 8;
        text("DUPLICATE SCANS", ML, y, 7.5, bold, C_PILL_WN);
        y -= 10;
        drawTable(
          [{ header: "Barcode", width: 110 }, { header: "Note", width: 220 }],
          disc.duplicateScans.map((d) => [d.barcode, d.note]),
          15,
        );
      }
      if (disc.openExceptions.length) {
        y -= 8;
        text("OPEN EXCEPTIONS", ML, y, 7.5, bold, C_PILL_NG);
        y -= 10;
        drawTable(
          [{ header: "Barcode", width: 100 }, { header: "Kind", width: 100 }, { header: "Explanation", width: 350 }],
          disc.openExceptions.map((e) => [e.barcode, e.kind, e.explanation]),
          15,
        );
      }
    }

    // ── Footer on every page ────────────────────────────────────────────────
    for (let i = 0; i < pdf.getPageCount(); i++) {
      const pg = pdf.getPage(i);
      pg.drawLine({ start: { x: ML, y: MB + 14 }, end: { x: W - MR, y: MB + 14 }, thickness: 0.4, color: C_RULE });
      pg.drawText(`${p.reference} - Purchase Reconciliation Report`, { x: ML, y: MB + 4, size: 7, font, color: C_MUTED });
      const pageLabel = `Page ${i + 1} of ${pdf.getPageCount()}`;
      const lw = font.widthOfTextAtSize(pageLabel, 7);
      pg.drawText(pageLabel, { x: W - MR - lw, y: MB + 4, size: 7, font, color: C_MUTED });
    }

    return Buffer.from(await pdf.save());
  }
}
