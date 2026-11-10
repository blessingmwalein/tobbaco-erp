import { AppError, formatMessage, type Bale, type MockDb } from "@tobacco/shared";
import { upperCode, validatePriceCents } from "@tobacco/validation";
import { audit, can, fail, requirePermission, type Ctx } from "../ctx";
import { sortBales } from "./floor-summary";

/**
 * Data capture (Manual 06): classification (TIMB grade/reason + hessian owner) and e-Buying (buyer, buyer grade, price,
 * sale code). Each field is validated SEPARATELY and saved or rejected on its own — "an invalid buyer grade isn't saved,
 * but a valid price on the same form is" — so the operations return per-field results instead of throwing.
 */

/** Hessian owner options are NOT documented (UQ-08) — demo values. Blank shows as "N/A" like the manual's Last Bale Details. */
export const HESSIAN_OWNERS = ["Grower", "Buyer", "Floor"] as const;

export type CaptureField = "timbGrade" | "hessianOwner" | "buyer" | "buyerGrade" | "price" | "saleCode";

export interface CaptureFieldResult {
  field: CaptureField;
  ok: boolean;
  value?: string | number;
  message?: string;
}

export interface BaleCaptureView {
  baleId: string;
  barcode: string;
  growerNo: string;
  growerName: string;
  mass: number;
  seq: number;
  group: number;
  lot: string;
  saleDate: string;
  balesInSale: number;
  saleId: string;
  saleRefNo: number;
  timbGrade?: string;
  hessianOwner?: string;
  buyerCode?: string;
  buyerGrade?: string;
  priceCents?: number;
  saleCode?: string;
}

export interface CaptureSaveResult {
  barcode: string;
  fields: CaptureFieldResult[];
  savedAny: boolean;
  rejectedAny: boolean;
  view: BaleCaptureView;
}

/** The bale must belong to a DRAFT sale (floor summary complete, not yet balanced). */
function findCapturableBale(db: MockDb, rawBarcode: string): Bale {
  const barcode = rawBarcode.trim();
  const bale = db.bales.find((b) => !b.ejected && b.ticketBarcode === barcode);
  if (!bale) return fail("FLOOR_BALE_NOT_FOUND", { barcode });
  const sale = bale.saleId ? db.sales.find((s) => s.id === bale.saleId) : undefined;
  if (!sale) return fail("CAPTURE_STATE_NOT_ALLOWED", { barcode });
  if (sale.status !== "DRAFT") return fail("BARCODE_ALREADY_PROCESSED", { sale: `#${sale.refNo}` });
  return bale;
}

export function toCaptureView(db: MockDb, bale: Bale): BaleCaptureView {
  const sale = db.sales.find((s) => s.id === bale.saleId)!;
  const siblings = sortBales(db.bales.filter((b) => b.gdnId === bale.gdnId && !b.ejected));
  const grower = db.growers.find((g) => g.growerNo === bale.growerNo);
  return {
    baleId: bale.id,
    barcode: bale.ticketBarcode ?? bale.scaleBarcode,
    growerNo: bale.growerNo,
    growerName: grower ? `${grower.firstName} ${grower.surname}` : bale.growerNo,
    mass: bale.mass,
    seq: siblings.findIndex((b) => b.id === bale.id) + 1,
    group: bale.group,
    lot: bale.lot,
    saleDate: sale.saleDate,
    balesInSale: siblings.length,
    saleId: sale.id,
    saleRefNo: sale.refNo,
    timbGrade: bale.timbGrade,
    hessianOwner: bale.hessianOwner,
    buyerCode: bale.buyerCode,
    buyerGrade: bale.buyerGrade,
    priceCents: bale.priceCents,
    saleCode: bale.saleCode,
  };
}

/** Scan step: identify the bale and show sale date, bales, grower, mass, SEQ, group and lot. */
export function lookupBale(ctx: Ctx, input: { barcode: string }): BaleCaptureView {
  requirePermission(ctx, "data-capture.view");
  return toCaptureView(ctx.db, findCapturableBale(ctx.db, input.barcode));
}

/** Pure read for UI previews (throws the same AppError). */
export function selectBaleForCapture(db: MockDb, barcode: string): BaleCaptureView {
  return toCaptureView(db, findCapturableBale(db, barcode));
}

// ── field appliers ──────────────────────────────────────────────

const blank = (v: unknown) => v === undefined || v === null || String(v).trim() === "";

export interface ClassificationInput {
  barcode: string;
  timbGrade?: string;
  hessianOwner?: string;
}

export interface BuyingInput {
  barcode: string;
  buyer?: string;
  buyerGrade?: string;
  /** US cents per kg, whole number. */
  price?: string | number;
  saleCode?: string;
  /** Explicitly remove an existing sale code (the bale was bought after all). */
  clearSaleCode?: boolean;
}

function applyClassification(ctx: Ctx, bale: Bale, input: ClassificationInput): CaptureFieldResult[] {
  const out: CaptureFieldResult[] = [];
  if (!blank(input.timbGrade)) {
    const code = upperCode(input.timbGrade);
    if (ctx.db.timbGrades.some((g) => g.code === code)) {
      bale.timbGrade = code;
      out.push({ field: "timbGrade", ok: true, value: code });
    } else {
      out.push({ field: "timbGrade", ok: false, value: code, message: formatMessage("INVALID_TIMB_GRADE", { value: code }) });
    }
  }
  if (!blank(input.hessianOwner)) {
    bale.hessianOwner = String(input.hessianOwner).trim();
    out.push({ field: "hessianOwner", ok: true, value: bale.hessianOwner });
  }
  return out;
}

function applyBuying(ctx: Ctx, bale: Bale, input: BuyingInput): CaptureFieldResult[] {
  const out: CaptureFieldResult[] = [];
  const { db } = ctx;

  if (!blank(input.buyer)) {
    const code = upperCode(input.buyer);
    if (db.buyers.some((b) => b.code === code)) {
      if (bale.buyerCode && bale.buyerCode !== code && bale.buyerGrade) {
        // Changing the buyer invalidates a grade that belonged to the previous buyer.
        const grades = db.buyers.find((b) => b.code === code)!.grades;
        if (!grades.includes(bale.buyerGrade)) bale.buyerGrade = undefined;
      }
      bale.buyerCode = code;
      out.push({ field: "buyer", ok: true, value: code });
    } else {
      out.push({ field: "buyer", ok: false, value: code, message: formatMessage("INVALID_BUYER", { value: code }) });
    }
  }

  if (!blank(input.buyerGrade)) {
    const grade = upperCode(input.buyerGrade);
    // Validated against the buyer saved on the bale (which includes a buyer saved a moment ago on this same form).
    const buyer = bale.buyerCode ? db.buyers.find((b) => b.code === bale.buyerCode) : undefined;
    if (buyer && buyer.grades.includes(grade)) {
      bale.buyerGrade = grade;
      out.push({ field: "buyerGrade", ok: true, value: grade });
    } else {
      out.push({ field: "buyerGrade", ok: false, value: grade, message: formatMessage("INVALID_BUYER_GRADE", { value: grade }) });
    }
  }

  if (!blank(input.price)) {
    if (!can(ctx, "data-capture.capture-price")) {
      out.push({ field: "price", ok: false, message: formatMessage("PERMISSION_DENIED", { permission: "data-capture.capture-price" }) });
    } else {
      const p = validatePriceCents(input.price as string | number);
      if (p.ok && p.value !== undefined) {
        bale.priceCents = p.value;
        out.push({ field: "price", ok: true, value: p.value });
      } else {
        out.push({ field: "price", ok: false, value: String(input.price), message: p.message });
      }
    }
  }

  if (input.clearSaleCode) {
    bale.saleCode = undefined;
    out.push({ field: "saleCode", ok: true, value: "" });
  } else if (!blank(input.saleCode)) {
    const code = upperCode(input.saleCode);
    // The full list of valid sale codes is not documented (UQ-08); only RO, RH and CO are known (rejected). Accept 1–3 letters.
    if (/^[A-Z]{1,3}$/.test(code)) {
      bale.saleCode = code;
      out.push({ field: "saleCode", ok: true, value: code });
    } else {
      out.push({ field: "saleCode", ok: false, value: code, message: `Invalid Sale Code: ${code}` });
    }
  }
  return out;
}

function finish(ctx: Ctx, bale: Bale, fields: CaptureFieldResult[], action: string, before: BaleCaptureView): CaptureSaveResult {
  if (fields.length === 0) throw new AppError("SALE_MISSING_FIELD", { barcode: bale.ticketBarcode ?? "", field: "any detail to save" });
  const savedAny = fields.some((f) => f.ok);
  const view = toCaptureView(ctx.db, bale);
  if (savedAny) {
    audit(ctx, {
      action,
      entityType: "Bale",
      entityId: bale.id,
      entityRef: bale.ticketBarcode,
      previous: { timbGrade: before.timbGrade, hessianOwner: before.hessianOwner, buyer: before.buyerCode, buyerGrade: before.buyerGrade, priceCents: before.priceCents, saleCode: before.saleCode },
      next: { timbGrade: view.timbGrade, hessianOwner: view.hessianOwner, buyer: view.buyerCode, buyerGrade: view.buyerGrade, priceCents: view.priceCents, saleCode: view.saleCode },
    });
  }
  return { barcode: view.barcode, fields, savedAny, rejectedAny: fields.some((f) => !f.ok), view };
}

export function saveClassification(ctx: Ctx, input: ClassificationInput): CaptureSaveResult {
  requirePermission(ctx, "data-capture.classify");
  const bale = findCapturableBale(ctx.db, input.barcode);
  const before = toCaptureView(ctx.db, bale);
  return finish(ctx, bale, applyClassification(ctx, bale, input), "data-capture.classify", before);
}

export function saveBuying(ctx: Ctx, input: BuyingInput): CaptureSaveResult {
  requirePermission(ctx, "data-capture.capture-buyer");
  const bale = findCapturableBale(ctx.db, input.barcode);
  const before = toCaptureView(ctx.db, bale);
  return finish(ctx, bale, applyBuying(ctx, bale, input), "data-capture.buyer", before);
}

/** "All Details" station: classification and buying on one form (needs both permissions). */
export function saveAllDetails(ctx: Ctx, input: ClassificationInput & BuyingInput): CaptureSaveResult {
  requirePermission(ctx, "data-capture.classify");
  requirePermission(ctx, "data-capture.capture-buyer");
  const bale = findCapturableBale(ctx.db, input.barcode);
  const before = toCaptureView(ctx.db, bale);
  const fields = [...applyClassification(ctx, bale, input), ...applyBuying(ctx, bale, input)];
  return finish(ctx, bale, fields, "data-capture.all-details", before);
}

/** Bales in Draft sales, with what each still needs — for the "simulate scan" chips and progress panels. */
export function selectCaptureQueue(db: MockDb): Array<{ barcode: string; growerNo: string; complete: boolean; missing: string[] }> {
  const draftIds = new Set(db.sales.filter((s) => s.status === "DRAFT").map((s) => s.id));
  return sortBales(db.bales.filter((b) => !b.ejected && b.ticketBarcode && b.saleId && draftIds.has(b.saleId))).map((b) => {
    const missing: string[] = [];
    if (b.saleCode) {
      if (!b.timbGrade) missing.push("reason");
    } else {
      if (!b.timbGrade) missing.push("TIMB grade");
      if (!b.buyerCode) missing.push("buyer");
      if (!b.buyerGrade) missing.push("buyer grade");
      if (!b.priceCents) missing.push("price");
    }
    return { barcode: b.ticketBarcode!, growerNo: b.growerNo, complete: missing.length === 0, missing };
  });
}
