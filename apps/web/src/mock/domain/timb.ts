import {
  AppError,
  Decimal,
  MESSAGES,
  formatMessage,
  isValidGrowerNo,
  normaliseGrowerNo,
  type Buyer,
  type Creditor,
  type Grower,
  type GrowerBankAccount,
  type GrowerBooking,
  type ImportJob,
  type ImportRowError,
  type ImportType,
  type MockDb,
  type Permission,
  type StopOrder,
} from "@tobacco/shared";
import { dateFromStopOrderFilename, upperCode, validateImportFilename } from "@tobacco/validation";
import { parseSampleCsv } from "@/lib/csv";
import { audit, failText, genericId, nextSeq, notify, padNum, requirePermission, type Ctx } from "../ctx";

/**
 * TIMB data imports (Manual 02, plus the stop-order import of Manual 07) and the register-side operations
 * (grower bank details, buyers). DEV ADAPTER: parses plain-text sample files. Real TIMB files are encrypted with a key
 * chosen by the file-name prefix (ELS… bookings, EL… stop orders); real decryption is NOT implemented (UQ-13).
 *
 * Failed imports (bad prefix, no valid records) are RECORDED as FAILED jobs and returned — they are not thrown,
 * because a thrown error would discard the transaction and lose the audit trail of the attempt.
 * Permission failures still throw (nothing is recorded).
 */

export const IMPORT_PERMISSION: Record<ImportType, Permission> = {
  GROWER_REGISTER: "timb.import-growers",
  CREDITOR_REGISTER: "timb.import-creditors",
  GROWER_BOOKING: "timb.import-bookings",
  STOP_ORDER: "timb.import-stop-orders",
};

export interface ImportTypeInfo {
  type: ImportType;
  label: string;
  description: string;
  /** Human-readable file-name rule shown in the workspace. */
  prefixRule: string;
  /** Whether the prefix rule is documented in the manuals. */
  prefixDocumented: boolean;
  columns: string[];
  optionalColumns: string[];
  manual: string;
  /** Where to look at the result. */
  resultHref: string;
}

export const IMPORT_TYPE_INFO: Record<ImportType, ImportTypeInfo> = {
  GROWER_BOOKING: {
    type: "GROWER_BOOKING",
    label: "Grower bookings",
    description: "TIMB's booking file: each grower, sell date and bales booked. Import it before receiving starts.",
    prefixRule: "File name starts with ELS (the first three characters select the floor's decryption key), e.g. ELS_ETHICAL_20260917.txt",
    prefixDocumented: true,
    columns: ["booking_ref", "grower_no", "first_name", "surname", "sell_date", "book_date", "bales_booked"],
    optionalColumns: [],
    manual: "Manual 02",
    resultHref: "/timb/bookings",
  },
  STOP_ORDER: {
    type: "STOP_ORDER",
    label: "Stop orders",
    description: "TIMB's stop order file for creditors such as input suppliers. The date in the file name links it to that day's sales.",
    prefixRule: "File name starts with EL (the first two characters select the key) and contains the sale date, e.g. EL_stoporders_20260917.txt",
    prefixDocumented: true,
    columns: ["stop_order_no", "grower_no", "creditor_code", "creditor_name", "amount_1", "amount_2", "amount_3", "priority", "rec_type", "percent"],
    optionalColumns: [],
    manual: "Manual 07",
    resultHref: "/finance/stop-orders",
  },
  GROWER_REGISTER: {
    type: "GROWER_REGISTER",
    label: "Grower register",
    description: "Registers new growers and updates existing ones. Import it first when a booking names an unknown grower.",
    prefixRule: "File-name prefix for register files is not documented (UQ-13) — any name is accepted by the dev adapter.",
    prefixDocumented: false,
    columns: ["grower_no", "first_name", "surname", "district"],
    optionalColumns: ["cellphone"],
    manual: "Manual 02",
    resultHref: "/growers",
  },
  CREDITOR_REGISTER: {
    type: "CREDITOR_REGISTER",
    label: "Creditor register",
    description: "Registers creditors (input suppliers and other stop-order beneficiaries).",
    prefixRule: "File-name prefix for register files is not documented (UQ-13) — any name is accepted by the dev adapter.",
    prefixDocumented: false,
    columns: ["creditor_code", "creditor_name"],
    optionalColumns: ["cellphone"],
    manual: "Manual 02",
    resultHref: "/creditors",
  },
};

export interface ImportInput {
  type: ImportType;
  filename: string;
  content: string;
}

export interface ImportRunInput extends ImportInput {
  sizeBytes: number;
  isSample: boolean;
}

export interface PreviewRow {
  /** 1-based data row (the header is not counted). */
  row: number;
  record: Record<string, string>;
  errors: ImportRowError[];
  action?: "create" | "update";
}

export interface TimbPreview {
  type: ImportType;
  filename: string;
  sizeBytes: number;
  lineCount: number;
  prefix: { ok: boolean; prefix?: string; message?: string };
  headers: string[];
  missingColumns: string[];
  headerOk: boolean;
  rows: PreviewRow[];
  rowErrors: ImportRowError[];
  validCount: number;
  wouldCreate: number;
  wouldUpdate: number;
  /** Stop orders: earlier same-date lines that the new file would replace (unpaid only). */
  wouldRemove: number;
  /** Stop orders: growers/creditors not in the system, created automatically (Manual 07). */
  autoCreate: { growers: number; creditors: number };
  fileDate?: string;
  checksum: string;
  /** A previous successful import of exactly this content. */
  duplicateOf?: { id: string; ref: string };
  /** Set when the file cannot be imported at all. */
  blockingMessage?: string;
  canImport: boolean;
}

export interface ImportOutcome {
  ok: boolean;
  job: ImportJob;
  message: string;
}

// ── helpers ─────────────────────────────────────────────────────
export function checksumOf(content: string): string {
  const norm = content.replace(/\r/g, "").trim();
  let h = 5381;
  for (let i = 0; i < norm.length; i++) h = ((h * 33) ^ norm.charCodeAt(i)) >>> 0;
  return `djb2-${h.toString(16)}-${norm.length}`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isIsoDate = (s: string) => ISO_DATE.test(s) && !Number.isNaN(new Date(`${s}T00:00:00`).getTime());
const isWholeNumber = (s: string) => /^\d+$/.test(s.trim());
const isMoney = (s: string) => /^\d+(\.\d{1,2})?$/.test(s.trim());
const toCents = (s: string) => new Decimal(s.trim()).mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();

const err = (row: number, field: string | undefined, value: string | undefined, message: string): ImportRowError => ({ row, field, value, message });

function stopOrderKey(fileDate: string, no: number, growerNo: string, creditorCode: string) {
  return `${fileDate}|${no}|${growerNo}|${creditorCode}`;
}

// ── preview (pure) ──────────────────────────────────────────────
/** Validate and analyse a file WITHOUT writing anything. The import runs the same analysis. */
export function previewTimbFile(db: MockDb, input: ImportInput & { sizeBytes?: number }): TimbPreview {
  const info = IMPORT_TYPE_INFO[input.type];
  const sizeBytes = input.sizeBytes ?? new TextEncoder().encode(input.content).length;
  const checksum = checksumOf(input.content);
  const parsed = parseSampleCsv(input.content);
  const lineCount = input.content.split(/\r?\n/).filter((l) => l.trim().length > 0 && !l.trim().startsWith("#")).length;
  const prefixCheck = validateImportFilename(input.type, input.filename);
  const missingColumns = info.columns.filter((c) => !parsed.headers.includes(c));
  const headerOk = parsed.headers.length > 0 && missingColumns.length === 0;

  const base: TimbPreview = {
    type: input.type,
    filename: input.filename,
    sizeBytes,
    lineCount,
    prefix: { ok: prefixCheck.ok, prefix: prefixCheck.prefix, message: prefixCheck.message },
    headers: parsed.headers,
    missingColumns,
    headerOk,
    rows: [],
    rowErrors: [],
    validCount: 0,
    wouldCreate: 0,
    wouldUpdate: 0,
    wouldRemove: 0,
    autoCreate: { growers: 0, creditors: 0 },
    checksum,
    canImport: false,
  };

  const dup = db.importJobs.find((j) => j.checksum === checksum && j.type === input.type && (j.status === "COMPLETED" || j.status === "COMPLETED_WITH_ERRORS"));
  if (dup) base.duplicateOf = { id: dup.id, ref: dup.ref };

  if (!prefixCheck.ok) {
    base.blockingMessage = prefixCheck.message;
    return base;
  }
  if (!headerOk) {
    base.blockingMessage =
      parsed.headers.length === 0
        ? MESSAGES.STOP_NO_VALID_RECORDS.text
        : `The file is missing required column(s): ${missingColumns.join(", ")}.`;
    return base;
  }
  if (parsed.rows.length === 0) {
    base.blockingMessage = MESSAGES.STOP_NO_VALID_RECORDS.text;
    return base;
  }

  const rows: PreviewRow[] = parsed.rows.map((record, i) => ({ row: i + 1, record, errors: [] }));
  switch (input.type) {
    case "GROWER_BOOKING":
      analyseBookings(db, rows);
      break;
    case "GROWER_REGISTER":
      analyseGrowers(db, rows);
      break;
    case "CREDITOR_REGISTER":
      analyseCreditors(db, rows);
      break;
    case "STOP_ORDER":
      analyseStopOrders(db, rows, base, input.filename);
      break;
  }
  base.rows = rows;
  base.rowErrors = rows.flatMap((r) => r.errors);
  base.validCount = rows.filter((r) => r.errors.length === 0).length;
  base.wouldCreate = rows.filter((r) => r.errors.length === 0 && r.action === "create").length;
  base.wouldUpdate = rows.filter((r) => r.errors.length === 0 && r.action === "update").length;
  // Stop orders: a file with no valid line is "wrong or corrupted" (Manual 07).
  if (input.type === "STOP_ORDER" && base.validCount === 0 && !base.blockingMessage) base.blockingMessage = MESSAGES.STOP_NO_VALID_RECORDS.text;
  base.canImport = !base.blockingMessage;
  return base;
}

function analyseBookings(db: MockDb, rows: PreviewRow[]) {
  const seen = new Set<string>();
  for (const r of rows) {
    const rec = r.record;
    const ref = (rec.booking_ref ?? "").trim().toUpperCase();
    const growerNo = normaliseGrowerNo(rec.grower_no ?? "");
    if (!ref || !/^[A-Z0-9]+$/.test(ref)) r.errors.push(err(r.row, "booking_ref", rec.booking_ref, "Booking reference is missing or not alphanumeric."));
    else if (seen.has(ref)) r.errors.push(err(r.row, "booking_ref", ref, "Duplicate booking reference in this file."));
    seen.add(ref);
    if (!isValidGrowerNo(growerNo)) r.errors.push(err(r.row, "grower_no", rec.grower_no, MESSAGES.GROWER_INVALID.text));
    else if (!db.growers.some((g) => g.growerNo === growerNo))
      r.errors.push(err(r.row, "grower_no", growerNo, `Grower ${growerNo} is not registered. Import the grower register, then import the booking file again.`));
    if (!isWholeNumber(rec.bales_booked ?? "") || Number(rec.bales_booked) < 1)
      r.errors.push(err(r.row, "bales_booked", rec.bales_booked, "Bales booked must be a whole number of 1 or more."));
    if (!isIsoDate((rec.sell_date ?? "").trim())) r.errors.push(err(r.row, "sell_date", rec.sell_date, "Sell date must be a date like 2026-09-17."));
    if (!isIsoDate((rec.book_date ?? "").trim())) r.errors.push(err(r.row, "book_date", rec.book_date, "Book date must be a date like 2026-09-16."));
    if (r.errors.length === 0) r.action = db.bookings.some((b) => b.bookedId === ref) ? "update" : "create";
  }
}

function analyseGrowers(db: MockDb, rows: PreviewRow[]) {
  const seen = new Set<string>();
  for (const r of rows) {
    const rec = r.record;
    const growerNo = normaliseGrowerNo(rec.grower_no ?? "");
    if (!isValidGrowerNo(growerNo)) r.errors.push(err(r.row, "grower_no", rec.grower_no, MESSAGES.GROWER_INVALID.text));
    else if (seen.has(growerNo)) r.errors.push(err(r.row, "grower_no", growerNo, "Duplicate grower number in this file."));
    seen.add(growerNo);
    if (!(rec.first_name ?? "").trim()) r.errors.push(err(r.row, "first_name", rec.first_name, "First name is required."));
    if (!(rec.surname ?? "").trim()) r.errors.push(err(r.row, "surname", rec.surname, "Surname is required."));
    if (!isWholeNumber(rec.district ?? "")) r.errors.push(err(r.row, "district", rec.district, "District must be a whole number."));
    if (r.errors.length === 0) r.action = db.growers.some((g) => g.growerNo === growerNo) ? "update" : "create";
  }
}

function analyseCreditors(db: MockDb, rows: PreviewRow[]) {
  const seen = new Set<string>();
  for (const r of rows) {
    const rec = r.record;
    const code = (rec.creditor_code ?? "").trim();
    if (!code || !/^[A-Za-z0-9]+$/.test(code)) r.errors.push(err(r.row, "creditor_code", rec.creditor_code, "Creditor code is missing or not alphanumeric."));
    else if (seen.has(code)) r.errors.push(err(r.row, "creditor_code", code, "Duplicate creditor code in this file."));
    seen.add(code);
    if (!(rec.creditor_name ?? "").trim()) r.errors.push(err(r.row, "creditor_name", rec.creditor_name, "Creditor name is required."));
    if (r.errors.length === 0) r.action = db.creditors.some((c) => c.code === code) ? "update" : "create";
  }
}

function analyseStopOrders(db: MockDb, rows: PreviewRow[], out: TimbPreview, filename: string) {
  const fileDate = dateFromStopOrderFilename(filename);
  if (!fileDate || !isIsoDate(fileDate)) {
    out.blockingMessage = "The file name does not contain a valid sale date (…YYYYMMDD…), so the stop orders cannot be linked to a day's sales.";
    return;
  }
  out.fileDate = fileDate;
  const seen = new Set<string>();
  const newGrowers = new Set<string>();
  const newCreditors = new Set<string>();
  const keysInFile = new Set<string>();
  for (const r of rows) {
    const rec = r.record;
    const growerNo = normaliseGrowerNo(rec.grower_no ?? "");
    const code = (rec.creditor_code ?? "").trim();
    const no = Number((rec.stop_order_no ?? "").trim());
    if (!isWholeNumber(rec.stop_order_no ?? "") || no < 1) r.errors.push(err(r.row, "stop_order_no", rec.stop_order_no, "Stop order number must be a whole number of 1 or more."));
    if (!isValidGrowerNo(growerNo)) r.errors.push(err(r.row, "grower_no", rec.grower_no, MESSAGES.GROWER_INVALID.text));
    if (!code || !/^[A-Za-z0-9]+$/.test(code)) r.errors.push(err(r.row, "creditor_code", rec.creditor_code, "Creditor code is missing or not alphanumeric."));
    for (const f of ["amount_1", "amount_2", "amount_3"] as const)
      if (!isMoney(rec[f] ?? "")) r.errors.push(err(r.row, f, rec[f], "Amount must be a decimal like 50.00."));
    if (!isWholeNumber(rec.priority ?? "")) r.errors.push(err(r.row, "priority", rec.priority, "Priority must be a whole number."));
    if (!(rec.rec_type ?? "").trim()) r.errors.push(err(r.row, "rec_type", rec.rec_type, "Record type is required."));
    if (!/^\d+(\.\d+)?$/.test((rec.percent ?? "").trim())) r.errors.push(err(r.row, "percent", rec.percent, "Percent must be a number."));
    if (r.errors.length === 0) {
      const key = stopOrderKey(fileDate, no, growerNo, code);
      if (seen.has(key)) r.errors.push(err(r.row, "stop_order_no", rec.stop_order_no, "Duplicate stop order line in this file."));
      else {
        seen.add(key);
        keysInFile.add(key);
        r.action = db.stopOrders.some((s) => stopOrderKey(s.fileDate, s.stopOrderNo, s.growerNo, s.creditorCode) === key) ? "update" : "create";
        if (!db.growers.some((g) => g.growerNo === growerNo)) newGrowers.add(growerNo);
        if (!db.creditors.some((c) => c.code === code)) newCreditors.add(code);
      }
    }
  }
  out.autoCreate = { growers: newGrowers.size, creditors: newCreditors.size };
  // "Importing a file … replaces that earlier import" (Manual 07; scope unverified, UQ-07): unpaid same-date lines absent from the new file are replaced.
  out.wouldRemove = db.stopOrders.filter(
    (s) => s.fileDate === fileDate && s.paidAmountCents === 0 && !keysInFile.has(stopOrderKey(s.fileDate, s.stopOrderNo, s.growerNo, s.creditorCode)),
  ).length;
}

// ── import (write) ──────────────────────────────────────────────
export function importTimbFile(ctx: Ctx, input: ImportRunInput): ImportOutcome {
  requirePermission(ctx, IMPORT_PERMISSION[input.type]);
  const preview = previewTimbFile(ctx.db, input);
  const records = preview.rows.map((r) => r.record);

  const record = (p: {
    status: ImportJob["status"];
    created: number;
    updated: number;
    rowErrors: ImportRowError[];
    resultMessage: string;
  }): ImportJob => {
    const n = nextSeq(ctx.db, "import");
    const job: ImportJob = {
      id: `import-${padNum(n, 4)}`,
      ref: `IMP-${padNum(n, 4)}`,
      type: input.type,
      filename: input.filename,
      sizeBytes: input.sizeBytes,
      status: p.status,
      created: p.created,
      updated: p.updated,
      errorCount: p.rowErrors.length,
      rowErrors: p.rowErrors,
      records,
      checksum: preview.checksum,
      startedAt: ctx.now,
      finishedAt: ctx.now,
      userId: ctx.actor.id,
      resultMessage: p.resultMessage,
      isSample: input.isSample,
    };
    ctx.db.importJobs.unshift(job);
    return job;
  };

  // Refused outright: wrong prefix, missing columns, no records. Recorded as FAILED (not thrown — see header note).
  if (preview.blockingMessage) {
    const message = preview.blockingMessage;
    const job = record({ status: "FAILED", created: 0, updated: 0, rowErrors: [err(0, undefined, input.filename, message)], resultMessage: message });
    audit(ctx, { action: `timb.import-${input.type.toLowerCase().replace("_", "-")}`, entityType: "ImportJob", entityId: job.id, entityRef: input.filename, reason: message, meta: { status: "FAILED" } });
    notify(ctx, { level: "error", title: `Import failed: ${input.filename}`, body: message, href: `/timb/imports/${job.id}` });
    return { ok: false, job, message };
  }

  let created = 0;
  let updated = 0;
  const jobIdPlaceholder = `import-${padNum(ctx.db.meta.seq.import + 1, 4)}`;
  const valid = preview.rows.filter((r) => r.errors.length === 0);
  const res =
    input.type === "GROWER_BOOKING"
      ? applyBookings(ctx, valid, jobIdPlaceholder)
      : input.type === "GROWER_REGISTER"
        ? applyGrowers(ctx, valid, input.isSample)
        : input.type === "CREDITOR_REGISTER"
          ? applyCreditors(ctx, valid)
          : applyStopOrders(ctx, valid, preview.fileDate!, input.filename, jobIdPlaceholder);
  created = res.created;
  updated = res.updated;

  const errors = preview.rowErrors.length;
  const key: "BOOKING_IMPORT_COMPLETE" | "STOP_IMPORT_COMPLETE" | "REGISTER_IMPORT_COMPLETE" =
    input.type === "GROWER_BOOKING" ? "BOOKING_IMPORT_COMPLETE" : input.type === "STOP_ORDER" ? "STOP_IMPORT_COMPLETE" : "REGISTER_IMPORT_COMPLETE";
  const message = formatMessage(key, { created, updated, errors });
  const job = record({
    status: errors > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
    created,
    updated,
    rowErrors: preview.rowErrors,
    resultMessage: message,
  });
  audit(ctx, {
    action: `timb.import-${input.type.toLowerCase().replace("_", "-")}`,
    entityType: "ImportJob",
    entityId: job.id,
    entityRef: input.filename,
    reason: message,
    meta: { created, updated, errors, removed: res.removed, autoCreated: res.autoCreated },
  });
  notify(ctx, {
    level: errors > 0 ? "warning" : "success",
    title: errors > 0 ? `Import complete with errors: ${input.filename}` : `Import complete: ${input.filename}`,
    body: message,
    href: `/timb/imports/${job.id}`,
  });
  return { ok: true, job, message };
}

interface ApplyResult {
  created: number;
  updated: number;
  removed?: number;
  autoCreated?: { growers: number; creditors: number };
}

function applyBookings(ctx: Ctx, rows: PreviewRow[], jobId: string): ApplyResult {
  let created = 0;
  let updated = 0;
  for (const r of rows) {
    const rec = r.record;
    const ref = rec.booking_ref!.trim().toUpperCase();
    const growerNo = normaliseGrowerNo(rec.grower_no!);
    const grower = ctx.db.growers.find((g) => g.growerNo === growerNo)!;
    const existing = ctx.db.bookings.find((b) => b.bookedId === ref);
    const sellDate = rec.sell_date!.trim();
    if (existing) {
      existing.sellDate = sellDate;
      existing.bookDate = rec.book_date!.trim();
      existing.balesBooked = Number(rec.bales_booked);
      existing.growerNo = growerNo;
      existing.firstName = grower.firstName;
      existing.surname = grower.surname;
      existing.lastUpdated = ctx.now;
      existing.importJobId = jobId;
      updated += 1;
    } else {
      const booking: GrowerBooking = {
        id: `booking-${ref}`,
        bookedId: ref,
        sellDate,
        season: Number(sellDate.slice(0, 4)),
        growerNo,
        firstName: grower.firstName,
        surname: grower.surname,
        bookDate: rec.book_date!.trim(),
        balesBooked: Number(rec.bales_booked),
        sourceBales: 0,
        floor: ctx.db.settings.sellingPointId,
        bookedBy: "TIMB Online",
        lastUpdated: ctx.now,
        importJobId: jobId,
      };
      ctx.db.bookings.unshift(booking);
      created += 1;
    }
  }
  return { created, updated };
}

function applyGrowers(ctx: Ctx, rows: PreviewRow[], isSample: boolean): ApplyResult {
  let created = 0;
  let updated = 0;
  for (const r of rows) {
    const rec = r.record;
    const growerNo = normaliseGrowerNo(rec.grower_no!);
    const existing = ctx.db.growers.find((g) => g.growerNo === growerNo);
    const cell = (rec.cellphone ?? "").trim() || undefined;
    if (existing) {
      existing.firstName = rec.first_name!.trim();
      existing.surname = rec.surname!.trim();
      existing.district = Number(rec.district);
      if (cell) existing.cellphone = cell;
      updated += 1;
    } else {
      const g: Grower = {
        growerNo,
        firstName: rec.first_name!.trim(),
        surname: rec.surname!.trim(),
        district: Number(rec.district),
        cellphone: cell,
        active: true,
        season: ctx.db.settings.seasonYear,
        isDemo: isSample ? true : undefined,
      };
      ctx.db.growers.push(g);
      created += 1;
    }
  }
  return { created, updated };
}

function applyCreditors(ctx: Ctx, rows: PreviewRow[]): ApplyResult {
  let created = 0;
  let updated = 0;
  for (const r of rows) {
    const rec = r.record;
    const code = rec.creditor_code!.trim();
    const existing = ctx.db.creditors.find((c) => c.code === code);
    const cell = (rec.cellphone ?? "").trim() || undefined;
    if (existing) {
      existing.name = rec.creditor_name!.trim();
      if (cell) existing.cellphone = cell;
      updated += 1;
    } else {
      const c: Creditor = { code, name: rec.creditor_name!.trim(), kind: "TIMB_CREDITOR", cellphone: cell, isDemo: true };
      ctx.db.creditors.push(c);
      created += 1;
    }
  }
  return { created, updated };
}

function applyStopOrders(ctx: Ctx, rows: PreviewRow[], fileDate: string, filename: string, jobId: string): ApplyResult {
  let created = 0;
  let updated = 0;
  let newGrowers = 0;
  let newCreditors = 0;
  const keys = new Set<string>();
  for (const r of rows) {
    const rec = r.record;
    const growerNo = normaliseGrowerNo(rec.grower_no!);
    const code = rec.creditor_code!.trim();
    const no = Number(rec.stop_order_no);
    keys.add(stopOrderKey(fileDate, no, growerNo, code));
    // "Creditors and growers that aren't in the system yet are created automatically." (Manual 07)
    if (!ctx.db.growers.some((g) => g.growerNo === growerNo)) {
      ctx.db.growers.push({ growerNo, firstName: "(from stop order file)", surname: growerNo, district: 0, active: true, season: ctx.db.settings.seasonYear, isDemo: true });
      newGrowers += 1;
    }
    if (!ctx.db.creditors.some((c) => c.code === code)) {
      ctx.db.creditors.push({ code, name: (rec.creditor_name ?? "").trim() || `Creditor ${code}`, kind: "TIMB_CREDITOR", isDemo: true });
      newCreditors += 1;
    }
    const existing = ctx.db.stopOrders.find((s) => stopOrderKey(s.fileDate, s.stopOrderNo, s.growerNo, s.creditorCode) === stopOrderKey(fileDate, no, growerNo, code));
    const fields = {
      timbFile: filename,
      amount1Cents: toCents(rec.amount_1!),
      amount2Cents: toCents(rec.amount_2!),
      amount3Cents: toCents(rec.amount_3!),
      priority: Number(rec.priority),
      recType: rec.rec_type!.trim(),
      percent: Number(rec.percent),
      importJobId: jobId,
    };
    if (existing) {
      Object.assign(existing, fields);
      updated += 1;
    } else {
      const so: StopOrder = {
        id: genericId(ctx.db, "stoporder"),
        fileDate,
        growerNo,
        creditorCode: code,
        stopOrderNo: no,
        paidAmountCents: 0,
        season: ctx.db.settings.seasonYear,
        createdAt: ctx.now,
        ...fields,
      };
      ctx.db.stopOrders.push(so);
      created += 1;
    }
  }
  // Replace the earlier import for this date: drop unpaid lines the new file no longer contains.
  const before = ctx.db.stopOrders.length;
  ctx.db.stopOrders = ctx.db.stopOrders.filter(
    (s) => s.fileDate !== fileDate || s.paidAmountCents > 0 || keys.has(stopOrderKey(s.fileDate, s.stopOrderNo, s.growerNo, s.creditorCode)),
  );
  return { created, updated, removed: before - ctx.db.stopOrders.length, autoCreated: { growers: newGrowers, creditors: newCreditors } };
}

// ── Grower bank accounts ────────────────────────────────────────
export interface BankAccountInput {
  /** Present when editing an existing account. */
  id?: string;
  growerNo: string;
  currency: string;
  bankName: string;
  bankCode: string;
  branchCode: string;
  accountNo: string;
  accountName: string;
}

/**
 * Add or edit a grower's bank account (Accounts, permission growers.edit-bank). One account per grower and currency.
 * Account-number format and bank/branch code rules are not documented (UQ-12/23) — only presence is enforced.
 */
export function saveGrowerBankAccount(ctx: Ctx, input: BankAccountInput): GrowerBankAccount {
  requirePermission(ctx, "growers.edit-bank");
  const grower = ctx.db.growers.find((g) => g.growerNo === input.growerNo);
  if (!grower) throw new AppError("GROWER_INVALID");
  const allowed = ["USD", ctx.db.settings.localCurrencyCode];
  if (!allowed.includes(input.currency)) failText(`Currency must be one of ${allowed.join(", ")}.`);
  for (const [k, label] of [
    ["bankName", "Bank name"],
    ["bankCode", "Bank code"],
    ["branchCode", "Branch code"],
    ["accountNo", "Account number"],
    ["accountName", "Account name"],
  ] as const) {
    if (!input[k].trim()) failText(`${label} is required.`);
  }
  if (!/^[0-9A-Za-z-]{4,24}$/.test(input.accountNo.trim())) failText("Account number must be 4–24 letters, digits or dashes.");
  const duplicate = ctx.db.growerBankAccounts.find((a) => a.growerNo === input.growerNo && a.currency === input.currency && a.id !== input.id);
  if (duplicate) failText(`${input.growerNo} already has a ${input.currency} bank account. Edit it instead.`);

  const fields = {
    growerNo: input.growerNo,
    currency: input.currency,
    bankName: input.bankName.trim(),
    bankCode: input.bankCode.trim(),
    branchCode: input.branchCode.trim(),
    accountNo: input.accountNo.trim(),
    accountName: input.accountName.trim(),
  };
  const existing = input.id ? ctx.db.growerBankAccounts.find((a) => a.id === input.id) : undefined;
  if (input.id && !existing) failText("Bank account not found.");
  if (existing) {
    const previous = { ...existing };
    Object.assign(existing, fields);
    audit(ctx, { action: "growers.edit-bank", entityType: "GrowerBankAccount", entityId: existing.id, entityRef: `${input.growerNo} ${input.currency}`, previous, next: { ...existing } });
    return existing;
  }
  const account: GrowerBankAccount = { id: `bank-${input.growerNo}-${input.currency}`, ...fields };
  ctx.db.growerBankAccounts.push(account);
  audit(ctx, { action: "growers.add-bank", entityType: "GrowerBankAccount", entityId: account.id, entityRef: `${input.growerNo} ${input.currency}`, next: { ...account } });
  return account;
}

export function removeGrowerBankAccount(ctx: Ctx, input: { id: string; reason: string }): void {
  requirePermission(ctx, "growers.edit-bank");
  const idx = ctx.db.growerBankAccounts.findIndex((a) => a.id === input.id);
  if (idx < 0) failText("Bank account not found.");
  if (input.reason.trim().length < 3) failText("A reason is required (at least 3 characters).");
  const [removed] = ctx.db.growerBankAccounts.splice(idx, 1);
  audit(ctx, { action: "growers.remove-bank", entityType: "GrowerBankAccount", entityId: removed!.id, entityRef: `${removed!.growerNo} ${removed!.currency}`, previous: { ...removed }, reason: input.reason });
}

// ── Buyers ──────────────────────────────────────────────────────
export interface BuyerInput {
  code: string;
  name: string;
  packingWarehouseCode?: string;
  grades: string[];
  /** true = create a new buyer; the code must not exist. */
  isNew?: boolean;
}

/**
 * Create/edit a buyer, its buyer grades and its packing warehouse. Reference data → admin.reference-data
 * (the Buyers page is READABLE with growers.view). Buyer grades are validated per buyer at data capture (Manual 06).
 */
export function saveBuyer(ctx: Ctx, input: BuyerInput): Buyer {
  requirePermission(ctx, "admin.reference-data");
  const code = upperCode(input.code);
  if (!/^[A-Z0-9]{1,8}$/.test(code)) failText("Buyer code must be 1–8 letters or digits.");
  if (!input.name.trim()) failText("Buyer name is required.");
  const grades = [...new Set(input.grades.map(upperCode).filter(Boolean))];
  if (grades.some((g) => !/^[A-Z0-9]{2,8}$/.test(g))) failText("Buyer grades must be 2–8 letters or digits, separated by commas or spaces.");
  const wh = input.packingWarehouseCode ? upperCode(input.packingWarehouseCode) : undefined;
  if (wh && !ctx.db.warehouses.some((w) => w.code === wh)) failText(`Warehouse ${wh} is not set up.`);
  const existing = ctx.db.buyers.find((b) => b.code === code);
  if (input.isNew && existing) failText(`Buyer ${code} already exists.`);
  if (!input.isNew && !existing) failText(`Buyer ${code} not found.`);

  let buyer: Buyer;
  if (existing) {
    const previous = { name: existing.name, packingWarehouseCode: existing.packingWarehouseCode, grades: [...existing.grades] };
    existing.name = input.name.trim();
    existing.packingWarehouseCode = wh;
    existing.grades = grades;
    buyer = existing;
    audit(ctx, { action: "buyers.edit", entityType: "Buyer", entityId: code, entityRef: code, previous, next: { name: buyer.name, packingWarehouseCode: wh, grades } });
  } else {
    buyer = { code, name: input.name.trim(), packingWarehouseCode: wh, grades, isDemo: true };
    ctx.db.buyers.push(buyer);
    audit(ctx, { action: "buyers.create", entityType: "Buyer", entityId: code, entityRef: code, next: { name: buyer.name, packingWarehouseCode: wh, grades } });
  }
  // Keep the warehouse ↔ buyer link consistent (dispatch checks the buyer's packing warehouse).
  for (const w of ctx.db.warehouses) {
    w.buyerCodes = w.buyerCodes.filter((c) => c !== code);
    if (w.code === wh) w.buyerCodes.push(code);
  }
  return buyer;
}
