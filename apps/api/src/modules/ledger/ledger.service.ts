import { Inject, Injectable } from "@nestjs/common";
import { Prisma, type Bale, type BaleEventType, type BaleStatus, type MovementRefType, type MovementType, type WarehouseKind } from "@prisma/client";
import { AppError } from "../../common/app-error";
import type { BuyerPrincipal } from "../../common/principal";
import { PrismaService, type TenantTx } from "../../database/prisma.service";

/**
 * THE inventory ledger. Every stock change in the Buyer Portal goes through here so that, in ONE transaction:
 *   1. the bale's projection (status + the single current location) changes — via a CONDITIONAL update, so a concurrent
 *      second caller sees count 0 and fails instead of double-receiving / double-dispatching;
 *   2. an immutable BaleMovement row is appended (where stock moved); and
 *   3. an immutable BaleEvent row is appended (the traceability timeline).
 * Inventory balances are therefore derivable from events/movements; `reconcileProjection` proves it.
 */
export interface LedgerCtx {
  tx: TenantTx;
  principal: BuyerPrincipal;
  /** Monotonic clock: every call is ≥1 ms later than the previous, so events in one transaction keep their order. */
  now: () => Date;
}

export function makeLedgerCtx(tx: TenantTx, principal: BuyerPrincipal): LedgerCtx {
  let last = Date.now() - 1;
  return {
    tx,
    principal,
    now: () => {
      last = Math.max(last + 1, Date.now());
      return new Date(last);
    },
  };
}

export interface LocationInput {
  warehouseId: string;
  bayId?: string | null;
  rowId?: string | null;
}

export interface ResolvedLocation {
  warehouseId: string;
  bayId: string | null;
  rowId: string | null;
  kind: WarehouseKind;
  label: string;
}

export interface RefInput {
  type: MovementRefType;
  id: string;
  label: string;
}

const STOCK_KIND: Partial<Record<BaleStatus, WarehouseKind>> = { IN_STOCK: "STANDARD", RETURNED: "PROCESSING" };

@Injectable()
export class LedgerService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ── locations ──────────────────────────────────────────────────────────────
  /** Validates warehouse → bay → row belong together, belong to the organisation (tenant client) and are active. */
  async resolveLocation(tx: TenantTx, input: LocationInput, opts: { kind?: WarehouseKind } = {}): Promise<ResolvedLocation> {
    const warehouse = await tx.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!warehouse) throw AppError.unprocessable("INVALID_LOCATION", "That warehouse does not exist");
    if (!warehouse.active) throw AppError.unprocessable("LOCATION_INACTIVE", `Warehouse ${warehouse.name} is inactive`);
    if (opts.kind && warehouse.kind !== opts.kind) {
      throw AppError.unprocessable(
        "WRONG_WAREHOUSE_KIND",
        opts.kind === "PROCESSING" ? "Processed tobacco must be stored in a processing warehouse" : "This stock must be stored in a standard buyer warehouse",
      );
    }
    let label = warehouse.name;
    let bayId: string | null = null;
    let rowId: string | null = null;
    if (input.bayId) {
      const bay = await tx.bay.findUnique({ where: { id: input.bayId } });
      if (!bay || bay.warehouseId !== warehouse.id) throw AppError.unprocessable("INVALID_LOCATION", "That bay is not in the chosen warehouse");
      if (!bay.active) throw AppError.unprocessable("LOCATION_INACTIVE", `Bay ${bay.code} is inactive`);
      bayId = bay.id;
      label += ` › ${bay.code}`;
      if (input.rowId) {
        const row = await tx.warehouseRow.findUnique({ where: { id: input.rowId } });
        if (!row || row.bayId !== bay.id) throw AppError.unprocessable("INVALID_LOCATION", "That row is not in the chosen bay");
        if (!row.active) throw AppError.unprocessable("LOCATION_INACTIVE", `Row ${row.code} is inactive`);
        rowId = row.id;
        label += ` › ${row.code}`;
      }
    } else if (input.rowId) {
      throw AppError.unprocessable("INVALID_LOCATION", "A row needs its bay");
    }
    return { warehouseId: warehouse.id, bayId, rowId, kind: warehouse.kind, label };
  }

  /** Human label for a stored location ("Buyer Main Warehouse › BAY-01 › ROW-A"). */
  async labelFor(tx: TenantTx, loc: { warehouseId?: string | null; bayId?: string | null; rowId?: string | null }): Promise<string | null> {
    if (!loc.warehouseId) return null;
    const [w, b, r] = await Promise.all([
      tx.warehouse.findUnique({ where: { id: loc.warehouseId } }),
      loc.bayId ? tx.bay.findUnique({ where: { id: loc.bayId } }) : null,
      loc.rowId ? tx.warehouseRow.findUnique({ where: { id: loc.rowId } }) : null,
    ]);
    return [w?.name, b?.code, r?.code].filter(Boolean).join(" › ") || null;
  }

  // ── timeline & ledger primitives ───────────────────────────────────────────
  appendEvent(
    ctx: LedgerCtx,
    baleId: string,
    e: { type: BaleEventType; fromLabel?: string | null; toLabel?: string | null; ref?: RefInput | null; refType?: string; notes?: string | null; payload?: Prisma.InputJsonValue },
  ) {
    return ctx.tx.baleEvent.create({
      data: {
        buyerOrganisationId: ctx.principal.organisationId,
        baleId,
        type: e.type,
        occurredAt: ctx.now(),
        performedById: ctx.principal.id,
        performedByName: ctx.principal.name,
        fromLabel: e.fromLabel ?? null,
        toLabel: e.toLabel ?? null,
        refType: e.ref?.type ?? e.refType ?? null,
        refId: e.ref?.id ?? null,
        refLabel: e.ref?.label ?? null,
        notes: e.notes ?? null,
        payload: e.payload,
      },
    });
  }

  private appendMovement(
    ctx: LedgerCtx,
    baleId: string,
    m: { type: MovementType; from?: Pick<Bale, "currentWarehouseId" | "currentBayId" | "currentRowId">; to?: ResolvedLocation | null; reason: string; ref?: RefInput | null; note?: string | null },
  ) {
    return ctx.tx.baleMovement.create({
      data: {
        buyerOrganisationId: ctx.principal.organisationId,
        baleId,
        type: m.type,
        fromWarehouseId: m.from?.currentWarehouseId ?? null,
        fromBayId: m.from?.currentBayId ?? null,
        fromRowId: m.from?.currentRowId ?? null,
        toWarehouseId: m.to?.warehouseId ?? null,
        toBayId: m.to?.bayId ?? null,
        toRowId: m.to?.rowId ?? null,
        reason: m.reason,
        performedById: ctx.principal.id,
        performedAt: ctx.now(),
        refType: m.ref?.type ?? "MANUAL",
        refId: m.ref?.id ?? null,
        note: m.note ?? null,
      },
    });
  }

  // ── state changes ──────────────────────────────────────────────────────────
  /**
   * EXPECTED → IN_STOCK (physically received). Optionally stores the bale in a location in the same step.
   * Conditional on status EXPECTED: a bale cannot be received twice.
   */
  async receive(ctx: LedgerCtx, bale: Pick<Bale, "id" | "barcode">, input: { session: RefInput; location?: ResolvedLocation | null; massKg?: Prisma.Decimal | string | null }): Promise<void> {
    if (input.location && input.location.kind !== "STANDARD") throw AppError.unprocessable("WRONG_WAREHOUSE_KIND", "Purchased bales are received into a standard buyer warehouse");
    const updated = await ctx.tx.bale.updateMany({
      where: { id: bale.id, status: "EXPECTED" },
      data: {
        status: "IN_STOCK",
        receivedAt: ctx.now(),
        currentWarehouseId: input.location?.warehouseId ?? null,
        currentBayId: input.location?.bayId ?? null,
        currentRowId: input.location?.rowId ?? null,
      },
    });
    if (updated.count !== 1) throw AppError.conflict("BALE_ALREADY_RECEIVED", `Bale ${bale.barcode} has already been received`);
    await this.appendEvent(ctx, bale.id, { type: "RECEIVED", ref: input.session, notes: input.massKg != null ? `Received mass ${String(input.massKg)} kg` : null });
    if (input.location) {
      await this.appendMovement(ctx, bale.id, { type: "STORE", to: input.location, reason: "Stored on receiving", ref: input.session });
      await this.appendEvent(ctx, bale.id, { type: "STORED", toLabel: input.location.label, ref: input.session });
    }
  }

  /**
   * Place or move a bale that is in stock. STORE (no location yet), MOVE (same warehouse), TRANSFER (other warehouse).
   * IN_STOCK bales stay in standard warehouses; RETURNED (processed) bales stay in processing warehouses.
   * Conditional on the bale still being where we read it — concurrent moves cannot overwrite each other.
   */
  async place(ctx: LedgerCtx, baleId: string, to: ResolvedLocation, input: { reason: string; ref?: RefInput | null; note?: string | null }): Promise<{ type: MovementType; from: string | null; to: string }> {
    const bale = await ctx.tx.bale.findUnique({ where: { id: baleId } });
    if (!bale) throw AppError.notFound("Bale");
    const requiredKind = STOCK_KIND[bale.status];
    if (!requiredKind) {
      throw AppError.conflict("BALE_NOT_IN_STOCK", `Bale ${bale.barcode} is ${bale.status.toLowerCase().replace("_", " ")} and cannot be moved`);
    }
    if (to.kind !== requiredKind) {
      throw AppError.unprocessable("WRONG_WAREHOUSE_KIND", requiredKind === "PROCESSING" ? "Processed bales stay in processing warehouses" : "Purchased stock stays in standard buyer warehouses");
    }
    const hadLocation = Boolean(bale.currentWarehouseId);
    if (hadLocation && bale.currentWarehouseId === to.warehouseId && bale.currentBayId === to.bayId && bale.currentRowId === to.rowId) {
      throw AppError.unprocessable("SAME_LOCATION", "The bale is already in that location");
    }
    const type: MovementType = !hadLocation ? "STORE" : bale.currentWarehouseId === to.warehouseId ? "MOVE" : "TRANSFER";
    const fromLabel = await this.labelFor(ctx.tx, { warehouseId: bale.currentWarehouseId, bayId: bale.currentBayId, rowId: bale.currentRowId });
    const updated = await ctx.tx.bale.updateMany({
      where: { id: bale.id, status: bale.status, currentWarehouseId: bale.currentWarehouseId, currentBayId: bale.currentBayId, currentRowId: bale.currentRowId },
      data: { currentWarehouseId: to.warehouseId, currentBayId: to.bayId, currentRowId: to.rowId },
    });
    if (updated.count !== 1) throw AppError.conflict("BALE_CHANGED", `Bale ${bale.barcode} was changed by someone else — reload and retry`);
    await this.appendMovement(ctx, bale.id, { type, from: bale, to, reason: input.reason, ref: input.ref, note: input.note });
    await this.appendEvent(ctx, bale.id, { type: type === "STORE" ? "STORED" : "MOVED", fromLabel, toLabel: to.label, ref: input.ref, notes: input.reason });
    return { type, from: fromLabel, to: to.label };
  }

  /**
   * IN_STOCK (standard warehouse) → DISPATCHED. Returns the exact source location (recorded on the dispatch line).
   * Conditional update: two concurrent dispatches of one bale → exactly one succeeds.
   */
  async dispatchOut(ctx: LedgerCtx, bale: Pick<Bale, "id" | "barcode">, input: { dispatch: RefInput; companyName: string }) {
    const current = await ctx.tx.bale.findUnique({ where: { id: bale.id } });
    if (!current || current.status !== "IN_STOCK" || !current.currentWarehouseId) {
      throw AppError.conflict("BALE_NOT_AVAILABLE", `Bale ${bale.barcode} is not available stock in a buyer warehouse`);
    }
    const sourceLabel = await this.labelFor(ctx.tx, { warehouseId: current.currentWarehouseId, bayId: current.currentBayId, rowId: current.currentRowId });
    const updated = await ctx.tx.bale.updateMany({
      where: { id: bale.id, status: "IN_STOCK", currentWarehouseId: current.currentWarehouseId, currentBayId: current.currentBayId, currentRowId: current.currentRowId },
      data: { status: "DISPATCHED", currentWarehouseId: null, currentBayId: null, currentRowId: null },
    });
    if (updated.count !== 1) throw AppError.conflict("BALE_NOT_AVAILABLE", `Bale ${bale.barcode} is no longer available`);
    await this.appendMovement(ctx, bale.id, { type: "DISPATCH_OUT", from: current, to: null, reason: `Dispatched to ${input.companyName}`, ref: input.dispatch });
    await this.appendEvent(ctx, bale.id, { type: "DISPATCHED", fromLabel: sourceLabel, toLabel: input.companyName, ref: input.dispatch });
    return { warehouseId: current.currentWarehouseId, bayId: current.currentBayId, rowId: current.currentRowId, label: sourceLabel, massKg: current.massKg };
  }

  /** DISPATCHED → RETURNED into a processing-warehouse location (same barcode). */
  async returnIn(ctx: LedgerCtx, bale: Pick<Bale, "id" | "barcode">, input: { ret: RefInput; location: ResolvedLocation; notes?: string | null; massKg?: Prisma.Decimal | string | null }): Promise<void> {
    if (input.location.kind !== "PROCESSING") throw AppError.unprocessable("WRONG_WAREHOUSE_KIND", "Processed tobacco must be stored in a processing warehouse");
    const data: Prisma.BaleUncheckedUpdateManyInput = {
      status: "RETURNED",
      currentWarehouseId: input.location.warehouseId,
      currentBayId: input.location.bayId,
      currentRowId: input.location.rowId,
    };
    if (input.massKg != null) data.massKg = input.massKg;
    const updated = await ctx.tx.bale.updateMany({ where: { id: bale.id, status: "DISPATCHED" }, data });
    if (updated.count !== 1) throw AppError.conflict("BALE_NOT_DISPATCHED", `Bale ${bale.barcode} is not out at a processor`);
    await this.appendMovement(ctx, bale.id, { type: "RETURN_IN", to: input.location, reason: "Returned from processing", ref: input.ret });
    await this.appendEvent(ctx, bale.id, { type: "RETURNED", toLabel: input.location.label, ref: input.ret, notes: input.notes });
    await this.appendEvent(ctx, bale.id, { type: "STORED", toLabel: input.location.label, ref: input.ret });
  }

  /**
   * Processing changed the bale's identity: the ORIGINAL record becomes SUPERSEDED, a NEW bale record (new barcode,
   * possibly new grade/mass) is created in the processing warehouse, and a BaleLineage row links the two. Both keep
   * their full history. Returns the new bale.
   */
  async reidentify(
    ctx: LedgerCtx,
    original: Bale,
    input: { newBarcode: string; newMassKg: Prisma.Decimal | string; newBuyerGrade?: string | null; newTimbGrade?: string | null; ret: RefInput; reason: string; location: ResolvedLocation },
  ): Promise<Bale> {
    if (input.location.kind !== "PROCESSING") throw AppError.unprocessable("WRONG_WAREHOUSE_KIND", "Processed tobacco must be stored in a processing warehouse");
    const superseded = await ctx.tx.bale.updateMany({ where: { id: original.id, status: "DISPATCHED" }, data: { status: "SUPERSEDED", currentWarehouseId: null, currentBayId: null, currentRowId: null } });
    if (superseded.count !== 1) throw AppError.conflict("BALE_NOT_DISPATCHED", `Bale ${original.barcode} is not out at a processor`);
    const created = await ctx.tx.bale.create({
      data: {
        buyerOrganisationId: ctx.principal.organisationId,
        purchaseId: original.purchaseId,
        barcode: input.newBarcode,
        season: original.season,
        buyerGrade: input.newBuyerGrade ?? original.buyerGrade,
        timbGrade: input.newTimbGrade ?? original.timbGrade,
        growerNo: original.growerNo,
        lotNo: original.lotNo,
        massKg: input.newMassKg,
        uscPerKg: original.uscPerKg,
        usdValue: original.usdValue,
        status: "RETURNED",
        isProcessed: true,
        receivedAt: ctx.now(),
        currentWarehouseId: input.location.warehouseId,
        currentBayId: input.location.bayId,
        currentRowId: input.location.rowId,
      },
    });
    await ctx.tx.baleLineage.create({
      data: { buyerOrganisationId: ctx.principal.organisationId, originalBaleId: original.id, newBaleId: created.id, originalBarcode: original.barcode, newBarcode: created.barcode, reason: input.reason, returnId: input.ret.id, createdById: ctx.principal.id },
    });
    await this.appendEvent(ctx, original.id, { type: "RE_IDENTIFIED", toLabel: created.barcode, ref: input.ret, notes: input.reason, payload: { role: "ORIGINAL", newBarcode: created.barcode } });
    await this.appendEvent(ctx, created.id, { type: "RE_IDENTIFIED", fromLabel: original.barcode, ref: input.ret, notes: input.reason, payload: { role: "NEW", originalBarcode: original.barcode } });
    await this.appendMovement(ctx, created.id, { type: "RETURN_IN", to: input.location, reason: "Returned from processing under a new barcode", ref: input.ret });
    await this.appendEvent(ctx, created.id, { type: "RETURNED", toLabel: input.location.label, ref: input.ret });
    await this.appendEvent(ctx, created.id, { type: "STORED", toLabel: input.location.label, ref: input.ret });
    return created;
  }

  // ── consistency proof ──────────────────────────────────────────────────────
  /**
   * Recompute every bale's status and current location from its immutable events and movements and compare with the
   * stored projection. An empty result proves "inventory balances = events". Used by tests and the admin health check.
   */
  async reconcileProjection(organisationId?: string): Promise<Array<{ baleId: string; barcode: string; field: "status" | "location"; projection: string | null; derived: string | null }>> {
    const bales = await this.prisma.bale.findMany({ where: organisationId ? { buyerOrganisationId: organisationId } : undefined, select: { id: true, barcode: true, status: true, currentWarehouseId: true, currentBayId: true, currentRowId: true } });
    const out: Array<{ baleId: string; barcode: string; field: "status" | "location"; projection: string | null; derived: string | null }> = [];
    for (const b of bales) {
      const [events, movements] = await Promise.all([
        this.prisma.baleEvent.findMany({ where: { baleId: b.id }, orderBy: [{ occurredAt: "asc" }, { id: "asc" }] }),
        this.prisma.baleMovement.findMany({ where: { baleId: b.id }, orderBy: [{ performedAt: "asc" }, { id: "asc" }] }),
      ]);
      const derivedStatus = deriveStatus(events);
      const last = movements[movements.length - 1];
      const derivedLoc = last ? [last.toWarehouseId, last.toBayId, last.toRowId].join("/") : [null, null, null].join("/");
      const projLoc = [b.currentWarehouseId, b.currentBayId, b.currentRowId].join("/");
      if (derivedStatus !== b.status) out.push({ baleId: b.id, barcode: b.barcode, field: "status", projection: b.status, derived: derivedStatus });
      if (derivedLoc !== projLoc) out.push({ baleId: b.id, barcode: b.barcode, field: "location", projection: projLoc, derived: derivedLoc });
    }
    return out;
  }
}

/** Status implied by a bale's event history. */
export function deriveStatus(events: Array<{ type: BaleEventType; payload: Prisma.JsonValue | null }>): BaleStatus | null {
  let status: BaleStatus | null = null;
  for (const e of events) {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    switch (e.type) {
      case "PURCHASED":
      case "IMPORTED":
        status = "EXPECTED";
        break;
      case "RECEIVED":
        status = "IN_STOCK";
        break;
      case "DISPATCHED":
        status = "DISPATCHED";
        break;
      case "RETURNED":
        status = "RETURNED";
        break;
      case "RE_IDENTIFIED":
        if (p.role === "ORIGINAL") status = "SUPERSEDED";
        break;
      case "CORRECTION":
        if (typeof p.toStatus === "string") status = p.toStatus as BaleStatus;
        break;
      default:
        break;
    }
  }
  return status;
}
