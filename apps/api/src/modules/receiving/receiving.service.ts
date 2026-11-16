import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { checkTicketBarcode } from "@tobacco/shared";
import { AppError } from "../../common/app-error";
import type { RequestMeta } from "../../common/decorators";
import type { BuyerPrincipal } from "../../common/principal";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { LedgerService, makeLedgerCtx } from "../ledger/ledger.service";

@Injectable()
export class ReceivingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LedgerService) private readonly ledger: LedgerService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(principal: BuyerPrincipal, query: { status?: string; purchaseId?: string }) {
    const db = this.prisma.forOrganisation(principal.organisationId);
    return db.receivingSession.findMany({
      where: { status: query.status as any, purchaseId: query.purchaseId, },
      orderBy: { startedAt: "desc" },
      include: { purchase: { select: { id: true, reference: true, totalBales: true, totalMassKg: true, receivingStatus: true } }, _count: { select: { scans: true, exceptions: true } } },
    });
  }

  async get(principal: BuyerPrincipal, id: string) {
    const db = this.prisma.forOrganisation(principal.organisationId);
    const session = await db.receivingSession.findUnique({
      where: { id },
      include: {
        scans: {
          orderBy: { scannedAt: "asc" },
          include: { bale: { select: { id: true, barcode: true, buyerGrade: true, timbGrade: true, growerNo: true, lotNo: true, massKg: true, uscPerKg: true, usdValue: true, status: true, currentWarehouseId: true, currentBayId: true, currentRowId: true } } },
        },
        exceptions: { orderBy: { raisedAt: "desc" } },
        purchase: {
          select: {
            id: true,
            reference: true,
            totalBales: true,
            totalMassKg: true,
            receivingStatus: true,
            bales: {
              orderBy: { barcode: "asc" },
              select: { id: true, barcode: true, buyerGrade: true, timbGrade: true, growerNo: true, lotNo: true, massKg: true, uscPerKg: true, usdValue: true, status: true, currentWarehouseId: true, currentBayId: true, currentRowId: true },
            },
          },
        },
      },
    });
    if (!session) throw AppError.notFound("Receiving session");
    return session;
  }

  async start(principal: BuyerPrincipal, input: { purchaseId: string; reference: string; defaultWarehouseId?: string; defaultBayId?: string; defaultRowId?: string; notes?: string }, meta: RequestMeta) {
    const created = await this.prisma.tenantTransaction(principal.organisationId, async (tx) => {
      const purchase = await tx.purchase.findUnique({ where: { id: input.purchaseId } });
      if (!purchase) throw AppError.notFound("Purchase");
      const openSession = await tx.receivingSession.findFirst({ where: { purchaseId: purchase.id, status: "OPEN" }, select: { reference: true } });
      if (openSession) throw AppError.conflict("PURCHASE_SESSION_OPEN", `Purchase already has an open receiving session (${openSession.reference})`);
      const session = await tx.receivingSession.create({ data: { buyerOrganisationId: principal.organisationId, purchaseId: purchase.id, reference: input.reference, startedById: principal.id, defaultWarehouseId: input.defaultWarehouseId ?? null, defaultBayId: input.defaultBayId ?? null, defaultRowId: input.defaultRowId ?? null, notes: input.notes ?? null } });
      await tx.purchase.update({ where: { id: purchase.id }, data: { receivingStatus: "IN_PROGRESS" } });
      await this.audit.record(tx, principal, { action: "receiving.session.created", entityType: "ReceivingSession", entityId: session.id, entityRef: session.reference, next: input, organisationId: principal.organisationId }, meta);
      return session;
    });
    return created;
  }

  async scan(principal: BuyerPrincipal, sessionId: string, input: { barcode: string; massKg?: string; warehouseId?: string; bayId?: string; rowId?: string; note?: string }, meta: RequestMeta) {
    return this.prisma.tenantTransaction(principal.organisationId, async (tx) => {
      const session = await tx.receivingSession.findUnique({ where: { id: sessionId } });
      if (!session) throw AppError.notFound("Receiving session");
      if (session.status !== "OPEN") throw AppError.conflict("SESSION_CLOSED", "This receiving session is no longer open");
      const raw = input.barcode;
      const checked = checkTicketBarcode(raw);
      let result: any = checked.valid ? "UNEXPECTED" : "INVALID_BARCODE";
      let bale: any = null;
      if (checked.valid) {
        bale = await tx.bale.findFirst({ where: { barcode: checked.barcode } }).catch(() => null);
        if (!bale) result = "UNEXPECTED";
        else if (bale.buyerOrganisationId !== principal.organisationId) result = "WRONG_BUYER";
        else if (bale.purchaseId !== session.purchaseId) result = "WRONG_PURCHASE";
        else if (bale.status !== "EXPECTED") result = "DUPLICATE_SCAN";
        else result = "RECEIVED";
      }
      if (result === "DUPLICATE_SCAN") throw AppError.conflict("DUPLICATE_SCAN", "Bale already scanned");
      let location: any = null;
      if (result === "RECEIVED") {
        const warehouseId = input.warehouseId ?? session.defaultWarehouseId;
        if (warehouseId) location = await this.ledger.resolveLocation(tx, { warehouseId, bayId: input.bayId ?? session.defaultBayId, rowId: input.rowId ?? session.defaultRowId }, { kind: "STANDARD" });
        await this.ledger.receive(makeLedgerCtx(tx, principal), bale, { session: { type: "RECEIVING_SESSION", id: session.id, label: session.reference }, location, massKg: input.massKg });
      }
      const scan = await tx.receivingScan.create({ data: { sessionId: session.id, buyerOrganisationId: principal.organisationId, barcode: raw, result, baleId: bale?.id ?? null, massKg: input.massKg ?? null, warehouseId: location?.warehouseId ?? null, bayId: location?.bayId ?? null, rowId: location?.rowId ?? null, scannedById: principal.id, note: input.note ?? null } });
      if (result !== "RECEIVED") await tx.receivingException.create({ data: { buyerOrganisationId: principal.organisationId, sessionId: session.id, scanId: scan.id, baleId: bale?.id ?? null, barcode: raw, kind: result, explanation: input.note ?? `Scan rejected: ${result}`, raisedById: principal.id } });
      await this.audit.record(tx, principal, { action: `receiving.scan.${String(result).toLowerCase()}`, entityType: "ReceivingScan", entityId: scan.id, entityRef: raw, next: { result, baleId: bale?.id ?? null }, organisationId: principal.organisationId }, meta);
      return { scan, bale, location };
    });
  }

  async confirm(principal: BuyerPrincipal, sessionId: string, meta: RequestMeta) {
    return this.prisma.tenantTransaction(principal.organisationId, async (tx) => {
      const session = await tx.receivingSession.findUnique({ where: { id: sessionId }, include: { purchase: { include: { bales: { orderBy: { barcode: "asc" } } } }, scans: { where: { result: "RECEIVED", voidedAt: null }, include: { bale: true }, orderBy: { scannedAt: "asc" } }, exceptions: { where: { status: "OPEN" } } } });
      if (!session) throw AppError.notFound("Receiving session");
      if (session.status !== "OPEN") throw AppError.conflict("SESSION_CLOSED", "This receiving session is no longer open");
      const receivedBales = session.scans.map((scan) => scan.bale).filter((bale): bale is NonNullable<typeof bale> => Boolean(bale));
      const expectedBarcodes = new Set(session.purchase.bales.map((bale) => bale.barcode));
      const receivedBarcodes = new Set(receivedBales.map((bale) => bale.barcode));
      const missingBarcodes = session.purchase.bales.filter((bale) => !receivedBarcodes.has(bale.barcode)).map((bale) => bale.barcode);
      if (session.exceptions.length || missingBarcodes.length || receivedBales.length !== session.purchase.totalBales) {
        throw AppError.conflict("RECONCILIATION_UNRESOLVED", "Resolve all receiving exceptions and receive every imported bale before confirmation");
      }
      if (receivedBales.some((bale) => !expectedBarcodes.has(bale.barcode))) {
        throw AppError.conflict("RECONCILIATION_MISMATCH", "One or more received bales are not on the purchase manifest");
      }
      const received = receivedBales.length;
      const scans = await tx.receivingScan.count({ where: { sessionId } });
      const reconciliation = { expectedBales: session.purchase.totalBales, receivedBales: received, scanned: scans, missingBales: 0, confirmedAt: new Date().toISOString() };
      const updated = await tx.receivingSession.update({ where: { id: sessionId }, data: { status: "CONFIRMED", confirmedById: principal.id, confirmedAt: new Date(), reconciliation: reconciliation as Prisma.InputJsonValue } });
      await this.audit.record(tx, principal, { action: "receiving.session.confirmed", entityType: "ReceivingSession", entityId: sessionId, entityRef: session.reference, next: reconciliation, organisationId: principal.organisationId }, meta);
      return updated;
    });
  }

  async finalise(principal: BuyerPrincipal, sessionId: string, input: { warehouseId: string; bayId: string; startingRowId: string }, meta: RequestMeta) {
    return this.prisma.tenantTransaction(principal.organisationId, async (tx) => {
      const session = await tx.receivingSession.findUnique({ where: { id: sessionId }, include: { purchase: { include: { bales: { orderBy: { barcode: "asc" } } } }, scans: { where: { result: "RECEIVED", voidedAt: null }, include: { bale: true }, orderBy: { scannedAt: "asc" } } } });
      if (!session) throw AppError.notFound("Receiving session");
      if (session.status !== "CONFIRMED") throw AppError.conflict("SESSION_NOT_CONFIRMED", "Confirm the reconciliation before finalising warehouse allocation");
      const receivedBales = session.scans.map((scan) => scan.bale).filter((bale): bale is NonNullable<typeof bale> => Boolean(bale));
      const warehouse = await tx.warehouse.findUnique({ where: { id: input.warehouseId }, include: { bays: { where: { id: input.bayId, active: true }, include: { rows: { where: { active: true }, orderBy: { code: "asc" } } } } } });
      const bay = warehouse?.bays[0];
      if (!warehouse || !bay || warehouse.kind !== "STANDARD") throw AppError.unprocessable("INVALID_LOCATION", "Select an active standard warehouse and bay");
      const startIndex = bay.rows.findIndex((row) => row.id === input.startingRowId);
      if (startIndex < 0) throw AppError.unprocessable("INVALID_LOCATION", "Select a starting row in the chosen bay");
      const rows = bay.rows.slice(startIndex);
      const assignments: Array<{ bale: typeof receivedBales[number]; rowId: string }> = [];
      let baleIndex = 0;
      for (const row of rows) {
        const capacity = row.capacityBales ?? receivedBales.length;
        for (let slot = 0; slot < capacity && baleIndex < receivedBales.length; slot += 1) assignments.push({ bale: receivedBales[baleIndex++]!, rowId: row.id });
        if (baleIndex === receivedBales.length) break;
      }
      if (assignments.length !== receivedBales.length) throw AppError.conflict("INSUFFICIENT_ROW_CAPACITY", "The selected starting row does not have enough capacity for the received bales");
      const locations = new Map(rows.map((row) => [row.id, row]));
      for (const assignment of assignments) {
        const row = locations.get(assignment.rowId)!;
        const location = await this.ledger.resolveLocation(tx, { warehouseId: warehouse.id, bayId: bay.id, rowId: row.id }, { kind: "STANDARD" });
        const current = assignment.bale.currentWarehouseId === location.warehouseId && assignment.bale.currentBayId === location.bayId && assignment.bale.currentRowId === location.rowId;
        if (!current) await this.ledger.place(makeLedgerCtx(tx, principal), assignment.bale.id, location, { reason: "Receiving reconciliation confirmed", ref: { type: "RECEIVING_SESSION", id: session.id, label: session.reference } });
      }
      const reconciliation = { ...(session.reconciliation as Record<string, unknown> | null), warehouseId: warehouse.id, bayId: bay.id, startingRowId: input.startingRowId, allocatedAt: new Date().toISOString() };
      const updated = await tx.receivingSession.update({ where: { id: sessionId }, data: { status: "ALLOCATED", reconciliation: reconciliation as Prisma.InputJsonValue } });
      await tx.purchase.update({ where: { id: session.purchase.id }, data: { receivingStatus: "COMPLETE" } });
      await this.audit.record(tx, principal, { action: "receiving.session.allocated", entityType: "ReceivingSession", entityId: sessionId, entityRef: session.reference, next: reconciliation, organisationId: principal.organisationId }, meta);
      return updated;
    });
  }

  async resolveException(principal: BuyerPrincipal, sessionId: string, exceptionId: string, resolution: string, meta: RequestMeta) {
    return this.prisma.tenantTransaction(principal.organisationId, async (tx) => {
      const exception = await tx.receivingException.findFirst({ where: { id: exceptionId, sessionId, status: "OPEN" } });
      if (!exception) throw AppError.notFound("Receiving exception");
      const updated = await tx.receivingException.update({ where: { id: exception.id }, data: { status: "RESOLVED", resolvedById: principal.id, resolvedAt: new Date(), resolution } });
      await this.audit.record(tx, principal, { action: "receiving.exception.resolved", entityType: "ReceivingException", entityId: exception.id, entityRef: exception.barcode, previous: exception, next: updated, organisationId: principal.organisationId }, meta);
      return updated;
    });
  }
}
