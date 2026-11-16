import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AppError } from "../../common/app-error";
import type { RequestMeta } from "../../common/decorators";
import type { BuyerPrincipal } from "../../common/principal";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { parseDispatchManifest } from "./shipments.parser";
import type { BuyerShipmentArrivalInput, BuyerShipmentImportInput } from "@tobacco/validation";

@Injectable()
export class ShipmentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async list(actor: BuyerPrincipal, query: { status?: string; search?: string }) {
    const db = this.prisma.forOrganisation(actor.organisationId);
    return db.buyerShipment.findMany({
      where: {
        status: query.status as any,
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

  async stage(actor: BuyerPrincipal, input: BuyerShipmentImportInput, meta: RequestMeta) {
    const parsed = parseDispatchManifest(input.content);
    const db = this.prisma.forOrganisation(actor.organisationId);
    const [purchase, warehouse, duplicate] = await Promise.all([
      db.purchase.findFirst({ where: { reference: input.purchaseReference } }),
      db.warehouse.findUnique({ where: { id: input.destinationWarehouseId } }),
      db.buyerShipmentImport.findFirst({ where: { reference: input.dispatchReference, status: { in: ["STAGED", "COMPLETED"] } } }),
    ]);
    if (!purchase) throw AppError.notFound("Purchase");
    if (!warehouse) throw AppError.notFound("Destination warehouse");
    if (warehouse.kind !== "STANDARD" || !warehouse.active) throw AppError.unprocessable("INVALID_LOCATION", "Select an active standard warehouse");
    if (duplicate) throw AppError.conflict("DUPLICATE_DISPATCH", "A dispatch import with this reference already exists");
    const metadata = { ...input, issues: parsed.issues };
    const created = await this.prisma.tenantTransaction(actor.organisationId, async (tx) => {
      const record = await tx.buyerShipmentImport.create({
        data: { buyerOrganisationId: actor.organisationId, reference: input.dispatchReference, filename: input.filename, content: input.content, metadata: metadata as Prisma.InputJsonValue, rows: parsed.rows as unknown as Prisma.InputJsonValue, recordCount: parsed.rows.length, validCount: parsed.rows.length - parsed.issues.length, invalidCount: parsed.issues.length },
      });
      await this.audit.record(tx, actor, { action: "buyer.shipment.import.staged", entityType: "BuyerShipmentImport", entityId: record.id, entityRef: record.reference, next: { purchaseReference: purchase.reference, rowCount: parsed.rows.length }, organisationId: actor.organisationId }, meta);
      return record;
    });
    return { ...created, metadata, rows: parsed.rows, purchase: { id: purchase.id, reference: purchase.reference }, destinationWarehouse: { id: warehouse.id, code: warehouse.code, name: warehouse.name } };
  }

  async confirm(actor: BuyerPrincipal, id: string, meta: RequestMeta) {
    return this.prisma.tenantTransaction(actor.organisationId, async (tx) => {
      const imp = await tx.buyerShipmentImport.findUnique({ where: { id } });
      if (!imp) throw AppError.notFound("Shipment import");
      if (imp.status !== "STAGED") throw AppError.conflict("IMPORT_COMPLETED", "This shipment import has already been completed");
      const metadata = imp.metadata as Record<string, string>;
      const rows = imp.rows as Array<{ barcode: string; massKg: string; rowNumber: number }>;
      if (imp.invalidCount) throw AppError.unprocessable("IMPORT_HAS_ERRORS", "Resolve shipment import validation errors before confirmation");
      const purchase = await tx.purchase.findFirst({ where: { reference: metadata.purchaseReference }, include: { bales: true } });
      if (!purchase) throw AppError.notFound("Purchase");
      const warehouse = await tx.warehouse.findUnique({ where: { id: metadata.destinationWarehouseId } });
      if (!warehouse || warehouse.kind !== "STANDARD" || !warehouse.active) throw AppError.unprocessable("INVALID_LOCATION", "The destination warehouse is not active");
      const barcodes = rows.map((row) => row.barcode);
      if (new Set(barcodes).size !== barcodes.length) throw AppError.conflict("DUPLICATE_BALE", "A dispatch manifest contains duplicate barcodes");
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
          dispatchDate: new Date(metadata.dispatchDate),
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
