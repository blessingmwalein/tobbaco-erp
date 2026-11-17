import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AppError } from "../../common/app-error";
import type { RequestMeta } from "../../common/decorators";
import type { BuyerPrincipal } from "../../common/principal";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { parseShipmentJson, type DispatchManifestIssue, type ShipmentJson } from "./shipments.parser";
import type { BuyerShipmentArrivalInput, BuyerShipmentImportInput } from "@tobacco/validation";

type ManifestRow = { rowNumber: number; barcode: string; massKg: string };
type StoredIssue = DispatchManifestIssue & { severity: "ERROR" };

interface StagedMetadata extends Record<string, unknown> {
  purchaseId: string;
  purchaseReference: string;
  destinationWarehouseId: string;
  dispatchReference: string;
  dispatchDate: string;
  dispatchLocation?: string | null;
  expectedArrivalAt?: string | null;
  truckRegistration: string;
  trailerRegistration?: string | null;
  driverName: string;
  driverPhone?: string | null;
  transporter?: string | null;
  notes?: string | null;
  sourceShipmentId?: string | number | null;
  issues: StoredIssue[];
}

@Injectable()
export class ShipmentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async list(actor: BuyerPrincipal, query: { status?: string; search?: string; purchaseId?: string }) {
    const db = this.prisma.forOrganisation(actor.organisationId);
    return db.buyerShipment.findMany({
      where: {
        status: query.status as any,
        purchaseId: query.purchaseId,
        OR: query.search ? [{ reference: { contains: query.search, mode: "insensitive" } }, { truckRegistration: { contains: query.search, mode: "insensitive" } }, { driverName: { contains: query.search, mode: "insensitive" } }] : undefined,
      },
      include: { purchase: { select: { id: true, reference: true, totalBales: true, totalMassKg: true, receivingStatus: true } }, destinationWarehouse: { select: { id: true, code: true, name: true } }, _count: { select: { bales: true, sessions: true } } },
      orderBy: { dispatchDate: "desc" },
    });
  }

  async get(actor: BuyerPrincipal, id: string) {
    const shipment = await this.prisma.forOrganisation(actor.organisationId).buyerShipment.findUnique({
      where: { id },
      include: {
        purchase: { select: { id: true, reference: true, totalBales: true, totalMassKg: true, totalUsdValue: true, receivingStatus: true } },
        destinationWarehouse: { select: { id: true, code: true, name: true } },
        bales: { include: { bale: { select: { id: true, barcode: true, massKg: true, buyerGrade: true, growerNo: true, lotNo: true, status: true, currentWarehouseId: true, currentBayId: true, currentRowId: true } } }, orderBy: { id: "asc" } },
        sessions: { select: { id: true, reference: true, status: true, startedAt: true, confirmedAt: true } },
      },
    });
    if (!shipment) throw AppError.notFound("Shipment");
    return shipment;
  }

  /**
   * Stage a shipment JSON for review. The purchase is resolved from the supplied reference OR derived from the
   * dispatched bale barcodes (the LeafLogix file carries no purchase reference). Bales are validated against the
   * original purchase manifest and existing shipments; nothing is committed until `confirm` is called.
   */
  async stage(actor: BuyerPrincipal, input: BuyerShipmentImportInput, meta: RequestMeta) {
    let parsed: ReturnType<typeof parseShipmentJson>;
    try {
      parsed = parseShipmentJson(input.content);
    } catch (e) {
      throw AppError.unprocessable("INVALID_SHIPMENT_JSON", e instanceof Error ? e.message : "The shipment file could not be parsed");
    }
    const shipmentMeta = parsed.metadata.shipment ?? {};
    const db = this.prisma.forOrganisation(actor.organisationId);

    const warehouse = await db.warehouse.findUnique({ where: { id: input.destinationWarehouseId } });
    if (!warehouse) throw AppError.notFound("Destination warehouse");
    if (warehouse.kind !== "STANDARD" || !warehouse.active) throw AppError.unprocessable("INVALID_LOCATION", "Select an active standard warehouse");

    const rows = parsed.rows;
    const issues: StoredIssue[] = parsed.issues.map((i) => ({ ...i, severity: "ERROR" as const }));

    // Duplicate barcodes inside this manifest.
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row.barcode) continue;
      if (seen.has(row.barcode)) issues.push({ rowNumber: row.rowNumber, field: "barcode", message: "Barcode appears more than once in this shipment", severity: "ERROR" });
      else seen.add(row.barcode);
    }

    // Resolve the purchase: explicitly by reference, otherwise derived from the bale barcodes.
    const barcodes = rows.map((r) => r.barcode).filter(Boolean);
    const candidateBales = barcodes.length ? await db.bale.findMany({ where: { barcode: { in: barcodes } }, select: { id: true, barcode: true, purchaseId: true, status: true } }) : [];
    const baleByBarcode = new Map(candidateBales.map((b) => [b.barcode, b]));
    let purchaseId: string | null = null;
    let purchaseReference: string | null = null;

    if (input.purchaseReference) {
      const purchase = await db.purchase.findFirst({ where: { reference: input.purchaseReference } });
      if (!purchase) throw AppError.notFound("Purchase");
      purchaseId = purchase.id;
      purchaseReference = purchase.reference;
    } else if (candidateBales.length) {
      const purchaseIds = new Set(candidateBales.map((b) => b.purchaseId));
      if (purchaseIds.size === 1) {
        const purchase = await db.purchase.findUnique({ where: { id: candidateBales[0]!.purchaseId } });
        if (purchase) { purchaseId = purchase.id; purchaseReference = purchase.reference; }
      } else {
        issues.push({ rowNumber: 0, field: "purchase", message: "Dispatched bales span more than one purchase — split the file or select the purchase", severity: "ERROR" });
      }
    }

    // Flag bales that are unknown, on the wrong purchase, or already dispatched.
    const rowsByBarcode = new Map(rows.map((r) => [r.barcode, r]));
    for (const row of rows) {
      if (!row.barcode) continue;
      const bale = baleByBarcode.get(row.barcode);
      if (!bale) { issues.push({ rowNumber: row.rowNumber, field: "barcode", message: "Bale is not on any imported purchase manifest", severity: "ERROR" }); continue; }
      if (purchaseId && bale.purchaseId !== purchaseId) issues.push({ rowNumber: row.rowNumber, field: "barcode", message: "Bale belongs to a different purchase", severity: "ERROR" });
      if (bale.status === "DISPATCHED" || bale.status === "IN_STOCK" || bale.status === "RETURNED") issues.push({ rowNumber: row.rowNumber, field: "barcode", message: `Bale has already been ${bale.status.toLowerCase().replace("_", " ")}`, severity: "ERROR" });
    }
    if (!purchaseId && !issues.some((i) => i.field === "purchase")) {
      issues.push({ rowNumber: 0, field: "purchase", message: "Could not identify a purchase from the dispatched bales — select the purchase explicitly", severity: "ERROR" });
    }

    // Already-dispatched check across existing shipments (defence in depth alongside the bale status check).
    if (purchaseId && barcodes.length) {
      const alreadyAssigned = await db.buyerShipmentBale.findMany({ where: { baleId: { in: candidateBales.map((b) => b.id) } }, select: { baleId: true } });
      const assigned = new Set(alreadyAssigned.map((a) => a.baleId));
      for (const bale of candidateBales) {
        if (assigned.has(bale.id)) {
          const row = rowsByBarcode.get(bale.barcode);
          if (row && !issues.some((i) => i.rowNumber === row.rowNumber && i.message.includes("already"))) issues.push({ rowNumber: row.rowNumber, field: "barcode", message: "Bale already belongs to another shipment", severity: "ERROR" });
        }
      }
    }

    const dispatchReference = (input.dispatchReference || (parsed.metadata.source_shipment_id != null ? `SHIPMENT-${parsed.metadata.source_shipment_id}` : null)) ?? "";
    if (!dispatchReference) issues.push({ rowNumber: 0, field: "reference", message: "A shipment reference is required (supply one or a source_shipment_id in the JSON)", severity: "ERROR" });
    const dispatchDate = input.dispatchDate || shipmentMeta.departure_date || "";
    if (!dispatchDate) issues.push({ rowNumber: 0, field: "dispatchDate", message: "A departure/dispatch date is required (supply one or a departure_date in the JSON)", severity: "ERROR" });
    const truckRegistration = input.truckRegistration || shipmentMeta.vehicle || "";
    if (!truckRegistration) issues.push({ rowNumber: 0, field: "truckRegistration", message: "A truck registration is required (supply one or a vehicle in the JSON)", severity: "ERROR" });
    const driverName = input.driverName || shipmentMeta.driver || "";
    if (!driverName) issues.push({ rowNumber: 0, field: "driverName", message: "A driver name is required (supply one or a driver in the JSON)", severity: "ERROR" });

    const duplicate = dispatchReference ? await db.buyerShipmentImport.findUnique({ where: { buyerOrganisationId_reference: { buyerOrganisationId: actor.organisationId, reference: dispatchReference } } }) : null;
    if (duplicate?.status === "COMPLETED") throw AppError.conflict("DUPLICATE_DISPATCH", "A shipment import with this reference already exists");
    if (duplicate && duplicate.content !== input.content) throw AppError.conflict("DUPLICATE_DISPATCH", "A staged shipment already uses this reference with different file content");
    if (duplicate && duplicate.content === input.content) return this.preview(actor, duplicate.id);

    const metadata: StagedMetadata = {
      purchaseId: purchaseId ?? "",
      purchaseReference: purchaseReference ?? "",
      destinationWarehouseId: warehouse.id,
      dispatchReference,
      dispatchDate,
      dispatchLocation: input.dispatchLocation ?? shipmentMeta.destination ?? null,
      expectedArrivalAt: input.expectedArrivalAt ?? null,
      truckRegistration,
      trailerRegistration: input.trailerRegistration ?? null,
      driverName,
      driverPhone: input.driverPhone ?? null,
      transporter: input.transporter ?? shipmentMeta.carrier ?? null,
      notes: input.notes ?? null,
      sourceShipmentId: parsed.metadata.source_shipment_id ?? null,
      issues,
    };

    const validRows = rows.filter((r) => !issues.some((i) => i.rowNumber === r.rowNumber)).length;
    const created = await this.prisma.tenantTransaction(actor.organisationId, async (tx) => {
      const record = await tx.buyerShipmentImport.create({
        data: {
          buyerOrganisationId: actor.organisationId,
          reference: dispatchReference || `STAGED-${Date.now()}`,
          filename: input.filename,
          content: input.content,
          metadata: metadata as unknown as Prisma.InputJsonValue,
          rows: rows as unknown as Prisma.InputJsonValue,
          recordCount: rows.length,
          validCount: validRows,
          invalidCount: rows.length - validRows,
        },
      });
      await this.audit.record(tx, actor, { action: "buyer.shipment.import.staged", entityType: "BuyerShipmentImport", entityId: record.id, entityRef: record.reference, next: { purchaseReference: purchaseReference ?? null, rowCount: rows.length, issueCount: issues.length }, organisationId: actor.organisationId }, meta);
      return record;
    });
    return this.preview(actor, created.id);
  }

  /** Preview a staged shipment import (purchase, warehouse, bale rows, validation issues) without committing it. */
  async preview(actor: BuyerPrincipal, id: string) {
    const imp = await this.prisma.forOrganisation(actor.organisationId).buyerShipmentImport.findUnique({ where: { id } });
    if (!imp) throw AppError.notFound("Shipment import");
    const metadata = imp.metadata as unknown as StagedMetadata;
    const purchase = metadata.purchaseId ? await this.prisma.forOrganisation(actor.organisationId).purchase.findUnique({ where: { id: metadata.purchaseId }, select: { id: true, reference: true, totalBales: true, totalMassKg: true, receivingStatus: true } }) : null;
    const warehouse = await this.prisma.forOrganisation(actor.organisationId).warehouse.findUnique({ where: { id: metadata.destinationWarehouseId }, select: { id: true, code: true, name: true } });
    return {
      id: imp.id,
      reference: imp.reference,
      filename: imp.filename,
      status: imp.status,
      recordCount: imp.recordCount,
      validCount: imp.validCount,
      invalidCount: imp.invalidCount,
      purchase: purchase ? { id: purchase.id, reference: purchase.reference, totalBales: purchase.totalBales, totalMassKg: purchase.totalMassKg.toString(), receivingStatus: purchase.receivingStatus } : null,
      destinationWarehouse: warehouse ? { id: warehouse.id, code: warehouse.code, name: warehouse.name } : null,
      rows: imp.rows as unknown as ManifestRow[],
      issues: metadata.issues ?? [],
      metadata: { dispatchDate: metadata.dispatchDate, dispatchLocation: metadata.dispatchLocation, truckRegistration: metadata.truckRegistration, driverName: metadata.driverName, transporter: metadata.transporter, sourceShipmentId: metadata.sourceShipmentId },
      shipmentId: imp.shipmentId,
      createdAt: imp.createdAt.toISOString(),
      confirmedAt: imp.confirmedAt?.toISOString() ?? null,
    };
  }

  /** Confirm a staged shipment import: create the in-transit shipment, link the dispatched bales, advance the reconciliation. */
  async confirm(actor: BuyerPrincipal, id: string, meta: RequestMeta) {
    return this.prisma.tenantTransaction(actor.organisationId, async (tx) => {
      const imp = await tx.buyerShipmentImport.findUnique({ where: { id } });
      if (!imp) throw AppError.notFound("Shipment import");
      if (imp.status !== "STAGED") throw AppError.conflict("IMPORT_COMPLETED", "This shipment import has already been completed");
      const metadata = imp.metadata as unknown as StagedMetadata;
      const rows = imp.rows as unknown as ManifestRow[];
      if (imp.invalidCount) throw AppError.unprocessable("IMPORT_HAS_ERRORS", "Resolve the shipment import validation errors before confirmation");
      if (!metadata.purchaseId) throw AppError.notFound("Purchase");
      const purchase = await tx.purchase.findUnique({ where: { id: metadata.purchaseId }, include: { bales: true } });
      if (!purchase) throw AppError.notFound("Purchase");
      const warehouse = await tx.warehouse.findUnique({ where: { id: metadata.destinationWarehouseId } });
      if (!warehouse || warehouse.kind !== "STANDARD" || !warehouse.active) throw AppError.unprocessable("INVALID_LOCATION", "The destination warehouse is not active");
      const barcodes = rows.map((row) => row.barcode);
      const bales = await tx.bale.findMany({ where: { purchaseId: purchase.id, barcode: { in: barcodes } } });
      if (bales.length !== rows.length) throw AppError.conflict("BALE_NOT_ON_PURCHASE", "One or more dispatched bales are not in the original purchase manifest");
      const alreadyAssigned = await tx.buyerShipmentBale.findMany({ where: { baleId: { in: bales.map((bale) => bale.id) } }, select: { baleId: true, shipmentId: true } });
      if (alreadyAssigned.length) throw AppError.conflict("BALE_ALREADY_DISPATCHED", "One or more bales already belong to an active shipment");
      if (bales.some((bale) => bale.status !== "EXPECTED")) throw AppError.conflict("BALE_ALREADY_RECEIVED", "One or more bales have already been received or stored");
      const baleByBarcode = new Map(bales.map((bale) => [bale.barcode, bale]));
      const shipment = await tx.buyerShipment.create({
        data: {
          buyerOrganisationId: actor.organisationId,
          purchaseId: purchase.id,
          reference: imp.reference,
          dispatchDate: new Date(`${metadata.dispatchDate}T00:00:00Z`),
          dispatchLocation: metadata.dispatchLocation || null,
          destinationWarehouseId: warehouse.id,
          expectedArrivalAt: metadata.expectedArrivalAt ? new Date(metadata.expectedArrivalAt) : null,
          truckRegistration: metadata.truckRegistration,
          trailerRegistration: metadata.trailerRegistration || null,
          driverName: metadata.driverName,
          driverPhone: metadata.driverPhone || null,
          transporter: metadata.transporter || null,
          notes: metadata.notes || null,
          expectedBales: rows.length,
          expectedMassKg: rows.reduce((total, row) => total + Number(row.massKg), 0),
          createdById: actor.id,
          bales: { create: rows.map((row) => ({ buyerOrganisationId: actor.organisationId, baleId: baleByBarcode.get(row.barcode)!.id, massKgAtDispatch: row.massKg })) },
        },
        include: { bales: true },
      });
      await tx.bale.updateMany({ where: { id: { in: bales.map((bale) => bale.id) } }, data: { status: "DISPATCHED" } });
      const dispatchedCount = await tx.buyerShipmentBale.count({ where: { shipment: { purchaseId: purchase.id } } });
      await tx.purchase.update({ where: { id: purchase.id }, data: { receivingStatus: dispatchedCount < purchase.totalBales ? "PARTIALLY_DISPATCHED" : "IN_PROGRESS" } });
      // The purchase-level reconciliation is now in progress (shipments are being delivered).
      await tx.purchaseReconciliation.updateMany({ where: { purchaseId: purchase.id, status: "AWAITING_SHIPMENTS" }, data: { status: "IN_PROGRESS" } });
      await tx.buyerShipmentImport.update({ where: { id }, data: { status: "COMPLETED", shipmentId: shipment.id, confirmedAt: new Date() } });
      await this.audit.record(tx, actor, { action: "buyer.shipment.created", entityType: "BuyerShipment", entityId: shipment.id, entityRef: shipment.reference, next: { purchaseId: purchase.id, baleCount: rows.length, truckRegistration: shipment.truckRegistration }, organisationId: actor.organisationId }, meta);
      return shipment;
    });
  }

  async arrive(actor: BuyerPrincipal, id: string, input: BuyerShipmentArrivalInput, meta: RequestMeta) {
    return this.prisma.tenantTransaction(actor.organisationId, async (tx) => {
      const shipment = await tx.buyerShipment.findUnique({ where: { id } });
      if (!shipment) throw AppError.notFound("Shipment");
      if (shipment.status !== "IN_TRANSIT") throw AppError.conflict("INVALID_SHIPMENT_STATUS", "Only in-transit shipments can be marked as arrived");
      if (shipment.destinationWarehouseId !== input.receivingWarehouseId) throw AppError.unprocessable("WRONG_DESTINATION", "The receiving warehouse does not match the shipment destination");
      const updated = await tx.buyerShipment.update({ where: { id }, data: { status: "ARRIVED", arrivedAt: input.actualArrivalAt ? new Date(input.actualArrivalAt) : new Date(), arrivedById: actor.id, actualTruckRegistration: input.actualTruckRegistration || null, arrivalNotes: input.arrivalNotes || null } });
      await this.audit.record(tx, actor, { action: "buyer.shipment.arrived", entityType: "BuyerShipment", entityId: id, entityRef: shipment.reference, previous: { status: shipment.status }, next: { status: updated.status, arrivedAt: updated.arrivedAt, actualTruckRegistration: updated.actualTruckRegistration }, organisationId: actor.organisationId }, meta);
      return updated;
    });
  }
}
