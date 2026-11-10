import { AppError, type Bale, type MockDb, type PriceBatch } from "@tobacco/shared";
import { validatePriceCents } from "@tobacco/validation";
import { audit, failText, requirePermission, type Ctx } from "../ctx";
import { sortBales } from "./floor-summary";

/**
 * Batch processing (Manual 06, Step 4): each grower's sale has a price batch. A second clerk re-enters every price from
 * the buyer's batch sheet WITHOUT looking at the captured prices (blind), then posts the batch. At balancing the captured
 * price must equal the batch price.
 */

export function batchBales(db: MockDb, batch: PriceBatch): Bale[] {
  return sortBales(db.bales.filter((b) => !b.ejected && b.saleId === batch.saleId && b.ticketBarcode));
}

const isPurchased = (b: Bale) => !b.saleCode;

export interface BatchRow {
  id: string;
  refNo: number;
  growerNo: string;
  firstName: string;
  surname: string;
  saleNo: number;
  sellingDate: string;
  sellingPointName: string;
  status: PriceBatch["status"];
  lastUpdatedBy: string;
  lastUpdatedByName: string;
  pricesEntered: number;
  pricesNeeded: number;
  saleId: string;
}

export function selectBatchRows(db: MockDb): BatchRow[] {
  return db.priceBatches
    .map((b): BatchRow => {
      const g = db.growers.find((x) => x.growerNo === b.growerNo);
      const bales = batchBales(db, b).filter(isPurchased);
      const historical = db.sales.find((s) => s.id === b.saleId)?.historical;
      return {
        id: b.id,
        refNo: b.refNo,
        growerNo: b.growerNo,
        firstName: g?.firstName ?? "",
        surname: g?.surname ?? "",
        saleNo: b.saleNo,
        sellingDate: b.sellingDate,
        sellingPointName: db.sellingPoints.find((s) => s.id === b.sellingPointId)?.name ?? b.sellingPointId,
        status: b.status,
        lastUpdatedBy: b.lastUpdatedBy,
        lastUpdatedByName: db.users.find((u) => u.id === b.lastUpdatedBy)?.name ?? b.lastUpdatedBy,
        pricesEntered: historical ? historical.baleCount : bales.filter((x) => x.batchPriceCents !== undefined).length,
        pricesNeeded: historical ? historical.baleCount : bales.length,
        saleId: b.saleId,
      };
    })
    .sort((a, b) => b.refNo - a.refNo);
}

export interface BatchDetail {
  batch: PriceBatch;
  growerName: string;
  sellingPointName: string;
  sale?: { id: string; refNo: number; status: string };
  bales: Bale[];
  pricesEntered: number;
  pricesNeeded: number;
  historical: boolean;
  history: Array<{ id: string; at: string; userName: string; action: string; barcode?: string; from?: number; to?: number; text: string }>;
}

export function selectBatchDetail(db: MockDb, batchId: string): BatchDetail | undefined {
  const batch = db.priceBatches.find((b) => b.id === batchId);
  if (!batch) return undefined;
  const g = db.growers.find((x) => x.growerNo === batch.growerNo);
  const sale = db.sales.find((s) => s.id === batch.saleId);
  const bales = batchBales(db, batch);
  const purchased = bales.filter(isPurchased);
  const history = db.audit
    .filter((a) => a.entityType === "PriceBatch" && a.entityId === batch.id)
    .map((a) => {
      const next = a.next as { batchPriceCents?: number | null; barcode?: string } | undefined;
      const prev = a.previous as { batchPriceCents?: number | null } | undefined;
      const text =
        a.action === "batch.set-price"
          ? `Ticket ${next?.barcode ?? ""} Batch Price: ${prev?.batchPriceCents ?? 0} → ${next?.batchPriceCents ?? 0}`
          : a.action === "batch.post"
            ? "Draft → Posted (Status) · Batch has been posted"
            : a.action;
      return { id: a.id, at: a.at, userName: a.userName, action: a.action, barcode: next?.barcode, from: prev?.batchPriceCents ?? undefined, to: next?.batchPriceCents ?? undefined, text };
    });
  return {
    batch,
    growerName: g ? `${g.firstName} ${g.surname}` : batch.growerNo,
    sellingPointName: db.sellingPoints.find((s) => s.id === batch.sellingPointId)?.name ?? batch.sellingPointId,
    sale: sale ? { id: sale.id, refNo: sale.refNo, status: sale.status } : undefined,
    bales,
    pricesEntered: purchased.filter((b) => b.batchPriceCents !== undefined).length,
    pricesNeeded: purchased.length,
    historical: Boolean(sale?.historical),
    history,
  };
}

/**
 * Enter (or clear, with null/"") the batch price for one ticket. Prices are US cents per kg, whole numbers.
 * Optional setting `requireDifferentBatchUser` (unverified — UQ-21): the clerk who captured the price may not enter the batch price.
 */
export function setBatchPrice(ctx: Ctx, input: { batchId: string; barcode: string; price: string | number | null }) {
  requirePermission(ctx, "batch.capture-price");
  const { db } = ctx;
  const batch = db.priceBatches.find((b) => b.id === input.batchId);
  if (!batch) return failText("Price batch not found");
  if (batch.status !== "DRAFT") return failText("This batch has already been posted. Prices can no longer be changed.");
  const bale = batchBales(db, batch).find((b) => b.ticketBarcode === input.barcode.trim());
  if (!bale) return failText(`Ticket ${input.barcode} is not part of batch ${batch.refNo}`);
  if (bale.saleCode) return failText(`Ticket ${bale.ticketBarcode} was not bought (sale code ${bale.saleCode}) — it needs no batch price.`);

  if (db.settings.requireDifferentBatchUser) {
    const capturedBySelf = db.audit.some(
      (a) => a.entityId === bale.id && a.action.startsWith("data-capture.") && a.userId === ctx.actor.id && (a.next as { priceCents?: number } | undefined)?.priceCents !== undefined,
    );
    if (capturedBySelf)
      return failText("The batch price must be entered by a different clerk than the one who captured the price (setting; unverified — UQ-21).");
  }

  const clearing = input.price === null || String(input.price).trim() === "";
  let value: number | undefined;
  if (!clearing) {
    const p = validatePriceCents(input.price as string | number);
    if (!p.ok || p.value === undefined) return failText(p.message ?? "Invalid price");
    value = p.value;
  }
  const previous = bale.batchPriceCents;
  bale.batchPriceCents = value;
  batch.lastUpdatedBy = ctx.actor.id;
  audit(ctx, {
    action: "batch.set-price",
    entityType: "PriceBatch",
    entityId: batch.id,
    entityRef: `Batch ${batch.refNo}`,
    previous: { batchPriceCents: previous ?? 0 },
    next: { batchPriceCents: value ?? 0, barcode: bale.ticketBarcode },
  });
  return { barcode: bale.ticketBarcode!, batchPriceCents: value };
}

/** Post Batch: Draft → Posted. Every purchased ticket needs a batch price (our assumption — the manual is silent). */
export function postBatch(ctx: Ctx, input: { batchId: string }) {
  requirePermission(ctx, "batch.post");
  const { db } = ctx;
  const batch = db.priceBatches.find((b) => b.id === input.batchId);
  if (!batch) return failText("Price batch not found");
  if (batch.status !== "DRAFT") return failText("This batch is already posted.");
  const missing = batchBales(db, batch).filter((b) => isPurchased(b) && b.batchPriceCents === undefined);
  if (missing.length > 0) throw new AppError("BATCH_PRICES_INCOMPLETE", { missing: missing.length });
  batch.status = "POSTED";
  batch.postedBy = ctx.actor.id;
  batch.postedAt = ctx.now;
  batch.lastUpdatedBy = ctx.actor.id;
  audit(ctx, {
    action: "batch.post",
    entityType: "PriceBatch",
    entityId: batch.id,
    entityRef: `Batch ${batch.refNo}`,
    previous: { status: "DRAFT" },
    next: { status: "POSTED" },
  });
  return batch;
}
