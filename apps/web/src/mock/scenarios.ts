import { DOCUMENTED, createSeedDb, ts } from "@tobacco/shared/fixtures";
import {
  buildTicketBarcode,
  checkTicketBarcode,
  type Bale,
  type DeliveryNote,
  type Deduction,
  type MockDb,
  type PriceBatch,
  type ScenarioId,
  type Sale,
} from "@tobacco/shared";
import { setDb } from "./store";

/**
 * Scenario presets: the DB state at each stage of the documented 17 Sep 2026 sale day, BUILT DIRECTLY from the
 * documented data. They are cumulative (each stage builds on the previous). They exist so reviewers can jump to any
 * stage and so each module's pages can be developed and tested independently. The real operations (mockApi) must
 * produce equivalent state — the Playwright journey test asserts that.
 *
 * Anything not documented in the manuals (V100061's masses/prices, per-line floor charges, …) is DEMO data.
 */

export interface ScenarioInfo {
  id: ScenarioId;
  label: string;
  description: string;
}

export const SCENARIOS: ScenarioInfo[] = [
  { id: "FRESH", label: "Fresh — morning of 17 Sep", description: "No sale date, no Start of Day, no bookings for today. Previous sales (11 Sep) are Processed." },
  { id: "START_OF_DAY", label: "1 · Daily setup done", description: "Receiving sale date active and Start of Day posted at 26.6845." },
  { id: "BOOKINGS_IMPORTED", label: "2 · Bookings imported", description: "ELS_ETHICAL_20260917.txt imported: V100060 × 3 and V100061 × 2 bales." },
  { id: "RECEIVING_IN_PROGRESS", label: "2b · Receiving in progress (mid-tally)", description: "TDN0000002 completed; GDN0000005 has 2 of 3 bales captured and GDN0000004 none — finish the tally to try Complete Delivery." },
  { id: "RECEIVED", label: "3 · Received & captured", description: "TDN0000002 completed; GDN0000005 / GDN0000004 closed with all 5 bales captured (Tickets Printing)." },
  { id: "TICKETS_CONFIRMED", label: "4 · Tickets confirmed", description: "Barcodes 1000001013–1000001035 and 1000001046–1000001057 printed and confirmed (Checked)." },
  { id: "FLOOR_SUMMARY_DONE", label: "5 · Floor summary done", description: "All tickets scanned into rows 1 and 2; deliveries Laid; draft sales 4 and 5 and price batches created." },
  { id: "READY_TO_BALANCE", label: "6 · Captured, batches posted", description: "Grades, buyer JM, buyer grade 11OF and prices captured; both price batches posted. Sales still Draft." },
  { id: "BALANCED", label: "7 · Sales balanced", description: "Both sales Balanced. Stop order file not imported yet." },
  { id: "PROCESSED", label: "8 · Deductions processed", description: "Stop order imported; deductions ($173.11) taken; sales Processed with pay batch 1001." },
  { id: "READY_TO_DISPATCH", label: "9 · Released, ready to dispatch", description: "Processed sales released for dispatch (buyer JM → CURVERID)." },
  { id: "VALIDATION_SHOWCASE", label: "Validation showcase (DEMO)", description: "V100061 captured with deliberate errors (missing grade, invalid buyer grade, price mismatch) to show the balancing checks." },
];

const D = DOCUMENTED;
const SP = "EL";
const DAY = D.saleDate;

const U = {
  admin: "user-system-admin",
  rcvSup: "user-receiving-supervisor",
  rcvClerk: "user-receiving-clerk",
  timb: "user-timb-clerk",
  ticket: "user-ticket-clerk",
  floor: "user-floor-summary-clerk",
  data: "user-data-clerk",
  dps: "user-data-processing-supervisor",
  accounts: "user-accounts",
};

const userName = (db: MockDb, id: string) => db.users.find((u) => u.id === id)?.name ?? id;

function addAudit(db: MockDb, userId: string, time: string, action: string, entityType: string, entityId: string, entityRef?: string, reason?: string) {
  db.meta.seq.audit += 1;
  db.audit.unshift({
    id: `aud-${String(db.meta.seq.audit).padStart(4, "0")}`,
    at: ts(DAY, time),
    userId,
    userName: userName(db, userId),
    action,
    entityType,
    entityId,
    entityRef,
    reason,
  });
}

// ── Stages ──────────────────────────────────────────────────────
function stageStartOfDay(db: MockDb) {
  for (const d of db.receivingSaleDates) d.isActive = false;
  db.receivingSaleDates.push({
    id: `rsd-${DAY}`,
    sellingPointId: SP,
    date: DAY,
    isActive: true,
    canScanFloorSummary: true,
    createdBy: U.rcvSup,
    createdAt: ts(DAY, "06:40:00"),
  });
  db.startOfDays.push({
    id: `sod-${DAY}`,
    sellingPointId: SP,
    sellingDate: DAY,
    exchangeRate: D.exchangeRate,
    status: "POSTED",
    createdBy: U.dps,
    createdAt: ts(DAY, "06:45:00"),
    postedBy: U.dps,
    postedAt: ts(DAY, "06:46:00"),
  });
  addAudit(db, U.rcvSup, "06:40:00", "sale-date.create", "ReceivingSaleDate", `rsd-${DAY}`, DAY);
  addAudit(db, U.dps, "06:46:00", "start-of-day.post", "StartOfDay", `sod-${DAY}`, DAY, `Exchange rate ${D.exchangeRate}`);
  for (const n of db.notifications) n.read = true;
}

function stageBookings(db: MockDb) {
  db.meta.seq.import += 1;
  const id = `import-${String(db.meta.seq.import).padStart(4, "0")}`;
  db.importJobs.unshift({
    id,
    ref: `IMP-${String(db.meta.seq.import).padStart(4, "0")}`,
    type: "GROWER_BOOKING",
    filename: D.files.booking,
    sizeBytes: 389,
    status: "COMPLETED",
    created: 2,
    updated: 0,
    errorCount: 0,
    rowErrors: [],
    records: D.growers.map((g) => ({
      booking_ref: g.bookingRef,
      grower_no: g.growerNo,
      first_name: g.firstName,
      surname: g.surname,
      sell_date: DAY,
      book_date: "2026-09-16",
      bales_booked: String(g.bales),
    })),
    checksum: "sample-booking-0917",
    startedAt: ts(DAY, "07:00:00"),
    finishedAt: ts(DAY, "07:00:04"),
    userId: U.timb,
    resultMessage: "Grower Booking Import complete: 2 created, 0 updated, 0 errors.",
    isSample: true,
  });
  for (const g of D.growers) {
    db.bookings.unshift({
      id: `booking-${g.bookingRef}`,
      bookedId: g.bookingRef,
      sellDate: DAY,
      season: D.season,
      growerNo: g.growerNo,
      firstName: g.firstName,
      surname: g.surname,
      bookDate: "2026-09-16",
      balesBooked: g.bales,
      sourceBales: 0,
      floor: SP,
      bookedBy: "TIMB Online",
      lastUpdated: ts(DAY, "07:00:04"),
      importJobId: id,
    });
  }
  addAudit(db, U.timb, "07:00:04", "timb.import-bookings", "ImportJob", id, D.files.booking, "2 created, 0 updated, 0 errors");
}

function stageReceived(db: MockDb) {
  db.meta.seq.tdn = 2;
  db.meta.seq.gdn = 5;
  db.meta.seq.bale = 5;
  const t = D.transporterNote;
  // GDNs are numbered V100061 → GDN0000004, V100060 → GDN0000005 (documented; see UQ-26).
  const gdnIdFor = (growerNo: string) => (growerNo === "V100060" ? "gdn-0000005" : "gdn-0000004");
  db.transporterNotes.push({
    id: "tdn-0000002",
    docNo: t.docNo,
    state: "COMPLETED",
    sellingPointId: SP,
    transporterName: t.transporterName,
    idNumber: t.idNumber,
    vehicleReg: t.vehicleReg,
    phone: t.phone,
    growers: D.growers.map((g) => ({ growerNo: g.growerNo, location: "A", bales: g.bales, saleDay: 17, saleMonth: 9, gdnId: gdnIdFor(g.growerNo) })),
    createdBy: U.rcvClerk,
    createdAt: ts(DAY, "08:55:00"),
    completedAt: ts(DAY, "09:05:00"),
  });
  const notes: DeliveryNote[] = D.growers.map((g) => ({
    id: gdnIdFor(g.growerNo),
    docNo: g.gdn,
    transporterNoteId: "tdn-0000002",
    growerNo: g.growerNo,
    location: "A",
    balesDeclared: g.bales,
    state: "TICKETS_PRINTING",
    sellingPointId: SP,
    sellingDate: DAY,
    season: D.season,
    floorSale: 1,
    lotHighest: g.bales_.length,
    lotLowest: 1,
    deliveryClosedAt: ts(DAY, g.growerNo === "V100060" ? "09:20:00" : "09:35:00"),
    createdAt: ts(DAY, "09:05:00"),
    updatedAt: ts(DAY, g.growerNo === "V100060" ? "09:20:00" : "09:35:00"),
    isDemo: g.demo ? true : undefined,
  }));
  db.deliveryNotes.push(...notes);
  let n = 0;
  for (const g of D.growers) {
    for (const b of g.bales_) {
      n += 1;
      const bale: Bale = {
        id: `bale-${n}`,
        scaleBarcode: b.scale,
        growerNo: g.growerNo,
        gdnId: gdnIdFor(g.growerNo),
        group: b.group,
        lot: b.lot,
        mass: b.mass,
        ejected: false,
        printed: false,
        capturedBy: U.rcvClerk,
        capturedAt: ts(DAY, `09:${String(10 + n).padStart(2, "0")}:00`),
        isDemo: g.demo ? true : undefined,
      };
      db.bales.push(bale);
    }
  }
  addAudit(db, U.rcvClerk, "09:05:00", "receiving.complete-transporter-note", "TransporterNote", "tdn-0000002", t.docNo, "2 growers, 5 bales");
  addAudit(db, U.rcvClerk, "09:20:00", "receiving.complete-delivery", "DeliveryNote", "gdn-0000005", "GDN0000005");
  addAudit(db, U.rcvClerk, "09:35:00", "receiving.complete-delivery", "DeliveryNote", "gdn-0000004", "GDN0000004");
}

function stageTickets(db: MockDb) {
  let n = 0;
  for (const g of D.growers) {
    const gdnId = g.growerNo === "V100060" ? "gdn-0000005" : "gdn-0000004";
    const note = db.deliveryNotes.find((d) => d.id === gdnId)!;
    note.startBarcode = g.bales_[0]!.ticket;
    note.state = "CHECKED";
    note.ticketsConfirmedAt = ts(DAY, g.growerNo === "V100060" ? "10:05:00" : "10:15:00");
    note.updatedAt = note.ticketsConfirmedAt;
    for (const b of g.bales_) {
      n += 1;
      const bale = db.bales.find((x) => x.scaleBarcode === b.scale)!;
      bale.ticketBarcode = b.ticket;
      bale.printed = true;
      bale.ticketDate = DAY;
    }
    const base = ts(DAY, g.growerNo === "V100060" ? "10:00:00" : "10:10:00");
    db.ticketEvents.push(
      { id: `tev-${n}a`, gdnId, kind: "ALLOCATE", at: base, userId: U.ticket, detail: `Allocated ${g.bales_.length} barcodes from ${g.bales_[0]!.ticket}` },
      { id: `tev-${n}b`, gdnId, kind: "PRINT", at: base, userId: U.ticket, detail: `Printed ${g.bales_.length} bale tickets` },
      { id: `tev-${n}c`, gdnId, kind: "CONFIRM", at: note.ticketsConfirmedAt, userId: U.ticket, detail: "Ticket printing confirmed — barcodes locked for the season" },
    );
    addAudit(db, U.ticket, g.growerNo === "V100060" ? "10:05:00" : "10:15:00", "tickets.confirm", "DeliveryNote", gdnId, g.gdn);
  }
  const last = checkTicketBarcode("1000001057");
  if (last.valid) db.userNextBarcode[U.ticket] = buildTicketBarcode(last.base + 1);
}

function stageFloorSummary(db: MockDb) {
  db.meta.seq.sale = 5;
  db.meta.seq.batch = 5;
  let sc = 0;
  // V100060 completes first (sale 4), then V100061 (sale 5) — documented IDs.
  for (const g of D.growers) {
    const gdnId = g.growerNo === "V100060" ? "gdn-0000005" : "gdn-0000004";
    const note = db.deliveryNotes.find((d) => d.id === gdnId)!;
    note.state = "LAID";
    note.row = g.row;
    const doneAt = ts(DAY, g.growerNo === "V100060" ? "11:00:00" : "11:10:00");
    note.updatedAt = doneAt;
    const saleId = `sale-${g.saleRefNo}`;
    let inGrower = 0;
    for (const b of g.bales_) {
      sc += 1;
      inGrower += 1;
      const bale = db.bales.find((x) => x.scaleBarcode === b.scale)!;
      bale.floorRow = g.row;
      bale.scannedAt = ts(DAY, `11:${String(sc).padStart(2, "0")}:00`);
      bale.saleId = saleId;
      db.floorScans.unshift({
        id: `scan-${sc}`,
        barcode: b.ticket,
        row: g.row,
        saleRoom: "A",
        at: bale.scannedAt,
        userId: U.floor,
        result: "OK",
        message: `Scanned ${inGrower} of ${g.bales_.length}`,
      });
    }
    const grower = db.growers.find((x) => x.growerNo === g.growerNo)!;
    db.floorSummaries.unshift({
      id: `fs-${String(g.saleRefNo).padStart(4, "0")}`,
      gdnId,
      growerNo: g.growerNo,
      sellingPointId: SP,
      sellingDate: DAY,
      season: D.season,
      district: grower.district,
      row: g.row,
      groupFirst: 1,
      groupLast: 1,
      totalBales: g.bales,
      unbooked: 0,
    });
    const sale: Sale = {
      id: saleId,
      refNo: g.saleRefNo,
      saleNo: 1,
      growerNo: g.growerNo,
      sellingPointId: SP,
      floorCode: "EL",
      saleDate: DAY,
      gdnId,
      priceBatchId: `batch-${g.batchRefNo}`,
      status: "DRAFT",
      released: false,
      createdAt: doneAt,
      updatedAt: doneAt,
      isDemo: g.demo ? true : undefined,
    };
    db.sales.push(sale);
    const batch: PriceBatch = {
      id: `batch-${g.batchRefNo}`,
      refNo: g.batchRefNo,
      saleId,
      growerNo: g.growerNo,
      saleNo: 1,
      sellingDate: DAY,
      sellingPointId: SP,
      status: "DRAFT",
      lastUpdatedBy: U.floor,
      createdAt: doneAt,
    };
    db.priceBatches.push(batch);
    addAudit(db, U.floor, g.growerNo === "V100060" ? "11:00:00" : "11:10:00", "floor-summary.complete", "FloorSummary", `fs-${String(g.saleRefNo).padStart(4, "0")}`, g.gdn, `Scanned ${g.bales} of ${g.bales}`);
  }
}

function stageCaptured(db: MockDb) {
  for (const g of D.growers) {
    for (const b of g.bales_) {
      const bale = db.bales.find((x) => x.scaleBarcode === b.scale)!;
      bale.timbGrade = b.timbGrade;
      bale.buyerCode = b.buyer;
      bale.buyerGrade = b.buyerGrade;
      bale.priceCents = b.priceCents;
      bale.batchPriceCents = b.priceCents;
    }
    const batch = db.priceBatches.find((x) => x.refNo === g.batchRefNo)!;
    batch.status = "POSTED";
    batch.postedBy = U.data;
    batch.postedAt = ts(DAY, g.growerNo === "V100060" ? "12:00:00" : "12:10:00");
    batch.lastUpdatedBy = U.data;
    addAudit(db, U.data, g.growerNo === "V100060" ? "12:00:00" : "12:10:00", "batch.post", "PriceBatch", batch.id, `Batch ${batch.refNo}`);
  }
}

function stageBalanced(db: MockDb) {
  for (const g of D.growers) {
    const sale = db.sales.find((s) => s.refNo === g.saleRefNo)!;
    sale.status = "BALANCED";
    sale.balancedBy = U.dps;
    sale.balancedAt = ts(DAY, g.growerNo === "V100060" ? "12:17:00" : "12:25:00");
    sale.updatedAt = sale.balancedAt;
    addAudit(db, U.dps, g.growerNo === "V100060" ? "12:17:00" : "12:25:00", "sales.balance", "Sale", sale.id, `Salesmaster ${sale.refNo}`);
  }
}

function stageProcessed(db: MockDb) {
  db.meta.seq.import += 1;
  const impId = `import-${String(db.meta.seq.import).padStart(4, "0")}`;
  const so = D.deductions.stopOrder;
  db.importJobs.unshift({
    id: impId,
    ref: `IMP-${String(db.meta.seq.import).padStart(4, "0")}`,
    type: "STOP_ORDER",
    filename: D.files.stopOrder,
    sizeBytes: 241,
    status: "COMPLETED",
    created: 1,
    updated: 0,
    errorCount: 0,
    rowErrors: [],
    records: [{ stop_order_no: "1", grower_no: so.growerNo, creditor_code: so.creditorCode, creditor_name: "Creditor 00050", amount_1: "50.00", amount_2: "0", amount_3: "0", priority: "1", rec_type: so.recType, percent: "0" }],
    checksum: "sample-stoporder-0917",
    startedAt: ts(DAY, "12:30:00"),
    finishedAt: ts(DAY, "12:30:03"),
    userId: U.dps,
    resultMessage: "Stop Order import complete — 1 created, 0 updated, 0 errors.",
    isSample: true,
  });
  db.stopOrders.push({
    id: "stoporder-1",
    timbFile: D.files.stopOrder,
    fileDate: DAY,
    growerNo: so.growerNo,
    creditorCode: so.creditorCode,
    amount1Cents: so.amountCents,
    amount2Cents: 0,
    amount3Cents: 0,
    paidAmountCents: so.amountCents,
    priority: so.priority,
    recType: so.recType,
    stopOrderNo: so.stopOrderNo,
    percent: 0,
    season: D.season,
    createdAt: ts(DAY, "12:30:03"),
    importJobId: impId,
  });

  const payBatchNo = D.payBatchNo;
  db.meta.seq.payBatch = payBatchNo;
  const processedAt = ts(DAY, "12:40:00");
  const deductions: Deduction[] = [];
  let n = 0;
  for (const g of D.growers) {
    const sale = db.sales.find((s) => s.refNo === g.saleRefNo)!;
    for (const charge of db.growerCharges.slice().sort((a, b) => a.order - b.order)) {
      const amount = charge.demoAmountCentsByGrower[g.growerNo];
      if (!amount) continue;
      n += 1;
      deductions.push({
        id: `ded-${n}`,
        saleId: sale.id,
        growerNo: g.growerNo,
        source: "GROWER_CHARGE",
        sequence: 1,
        creditorCode: charge.creditorCode,
        creditorName: charge.name,
        description: charge.name,
        currency: "USD",
        amountCents: amount,
        paidCents: amount,
        payBatchNo,
        sellingDate: DAY,
        createdAt: processedAt,
        isDemoAmount: true,
      });
    }
    if (g.growerNo === so.growerNo) {
      n += 1;
      deductions.push({
        id: `ded-${n}`,
        saleId: sale.id,
        growerNo: g.growerNo,
        source: "TIMB_STOP_ORDER",
        sequence: 5,
        creditorCode: so.creditorCode,
        creditorName: "Creditor 00050",
        description: `Stop order #${so.stopOrderNo}`,
        currency: "USD",
        amountCents: so.amountCents,
        paidCents: so.amountCents,
        payBatchNo,
        sellingDate: DAY,
        createdAt: processedAt,
      });
    }
    sale.status = "PROCESSED";
    sale.payBatchNo = payBatchNo;
    sale.processedBy = U.dps;
    sale.processedAt = processedAt;
    sale.updatedAt = processedAt;
  }
  db.deductions.push(...deductions);
  db.payBatches.push({
    no: payBatchNo,
    sellingPointId: SP,
    saleDate: DAY,
    saleIds: D.growers.map((g) => `sale-${g.saleRefNo}`),
    createdAt: processedAt,
    createdBy: U.dps,
  });
  addAudit(db, U.dps, "12:30:03", "timb.import-stop-orders", "ImportJob", impId, D.files.stopOrder, "1 created, 0 updated, 0 errors");
  addAudit(db, U.dps, "12:40:00", "deductions.process", "PayBatch", String(payBatchNo), String(payBatchNo), "2 sales processed");
}

function stageReleased(db: MockDb) {
  for (const g of D.growers) {
    const sale = db.sales.find((s) => s.refNo === g.saleRefNo)!;
    sale.released = true;
    sale.releasedBy = U.dps;
    sale.releasedAt = ts(DAY, "13:00:00");
    for (const bale of db.bales) if (bale.saleId === sale.id) { /* ticket-level release flag derives from sale */ }
    addAudit(db, U.dps, "13:00:00", "sales.release", "Sale", sale.id, `Salesmaster ${sale.refNo}`);
  }
}

/** DEMO: V100061 captured with deliberate errors so the balancing preview has something to say. */
function stageValidationShowcase(db: MockDb) {
  const g60 = D.growers[0]!;
  for (const b of g60.bales_) {
    const bale = db.bales.find((x) => x.scaleBarcode === b.scale)!;
    bale.timbGrade = b.timbGrade;
    bale.buyerCode = b.buyer;
    bale.buyerGrade = b.buyerGrade;
    bale.priceCents = b.priceCents;
    bale.batchPriceCents = b.priceCents;
  }
  const batch60 = db.priceBatches.find((x) => x.refNo === g60.batchRefNo)!;
  batch60.status = "POSTED";
  batch60.postedBy = U.data;
  batch60.postedAt = ts(DAY, "12:00:00");
  const g61 = D.growers[1]!;
  const [b1, b2] = g61.bales_;
  const bale1 = db.bales.find((x) => x.scaleBarcode === b1!.scale)!;
  bale1.buyerCode = "JM";
  bale1.buyerGrade = "11OF";
  bale1.priceCents = b1!.priceCents; // missing TIMB grade on purpose
  bale1.batchPriceCents = b1!.priceCents;
  const bale2 = db.bales.find((x) => x.scaleBarcode === b2!.scale)!;
  bale2.timbGrade = b2!.timbGrade;
  bale2.buyerCode = "KT"; // buyer grade 11OF does not belong to KT
  bale2.buyerGrade = "11OF";
  bale2.priceCents = b2!.priceCents;
  bale2.batchPriceCents = b2!.priceCents + 5; // price mismatch on purpose
  const batch61 = db.priceBatches.find((x) => x.refNo === g61.batchRefNo)!;
  batch61.status = "POSTED";
  batch61.postedBy = U.data;
  batch61.postedAt = ts(DAY, "12:10:00");
}

/** Mid-receiving: the truck note is completed (GDNs Open) but only V100060's first two bales are captured. */
function stageReceivingInProgress(db: MockDb) {
  for (const n of db.deliveryNotes.filter((d) => d.sellingDate === DAY)) {
    n.state = "OPEN";
    delete n.deliveryClosedAt;
    delete n.lotHighest;
    delete n.lotLowest;
  }
  db.bales = db.bales.filter((b) => b.scaleBarcode === "2609170001" || b.scaleBarcode === "2609170002");
  db.meta.seq.bale = 2;
  db.audit = db.audit.filter((a) => a.action !== "receiving.complete-delivery");
}

const ORDER: Array<[ScenarioId, (db: MockDb) => void]> = [
  ["START_OF_DAY", stageStartOfDay],
  ["BOOKINGS_IMPORTED", stageBookings],
  ["RECEIVED", stageReceived],
  ["TICKETS_CONFIRMED", stageTickets],
  ["FLOOR_SUMMARY_DONE", stageFloorSummary],
  ["READY_TO_BALANCE", stageCaptured],
  ["BALANCED", stageBalanced],
  ["PROCESSED", stageProcessed],
  ["READY_TO_DISPATCH", stageReleased],
];

export function buildScenario(id: ScenarioId): MockDb {
  const db = createSeedDb();
  if (id === "FRESH") return db;
  if (id === "RECEIVING_IN_PROGRESS") {
    stageStartOfDay(db);
    stageBookings(db);
    stageReceived(db);
    stageReceivingInProgress(db);
    db.meta.scenario = id;
    return db;
  }
  if (id === "VALIDATION_SHOWCASE") {
    for (const [stageId, apply] of ORDER) {
      apply(db);
      if (stageId === "FLOOR_SUMMARY_DONE") break;
    }
    stageValidationShowcase(db);
    db.meta.scenario = id;
    return db;
  }
  for (const [stageId, apply] of ORDER) {
    apply(db);
    if (stageId === id) break;
  }
  db.meta.scenario = id;
  return db;
}

export function applyScenario(id: ScenarioId): void {
  setDb(buildScenario(id));
}
