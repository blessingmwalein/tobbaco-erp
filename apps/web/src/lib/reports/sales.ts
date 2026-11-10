import { PRICE_BATCH_STATES, SALE_STATES, formatInt, formatUsd } from "@tobacco/shared";
import {
  baleIsComplete,
  growerName,
  growerOk,
  humanise,
  inRange,
  saleBaleCount,
  saleBales,
  saleDeductionsCents,
  saleGrossCents,
  saleMassKg,
  seasonOk,
  spOk,
  userNameOf,
} from "./helpers";
import type { ReportDef, ReportResult } from "./types";

export const dataCaptureReport: ReportDef = {
  slug: "data-capture",
  title: "Data capture report",
  description: "Per-bale classification and e-Buying capture: TIMB grade, hessian, buyer, buyer grade, price and sale code.",
  area: "Floor & sales",
  filters: ["date", "season", "grower", "buyer", "status"],
  statusLabel: "Capture state",
  statusOptions: [
    { value: "COMPLETE", label: "Complete" },
    { value: "INCOMPLETE", label: "Awaiting capture" },
  ],
  run(db, f): ReportResult {
    const rows = db.bales
      .filter((b) => b.saleId && !b.ejected)
      .map((b) => ({ b, sale: db.sales.find((s) => s.id === b.saleId) }))
      .filter(({ b, sale }) => sale && inRange(sale.saleDate, f) && seasonOk(sale.saleDate, f) && growerOk(b.growerNo, f) && (!f.buyer || b.buyerCode === f.buyer))
      .filter(({ b }) => !f.status || (f.status === "COMPLETE") === baleIsComplete(b))
      .map(({ b, sale }) => ({
        date: sale!.saleDate,
        ticket: b.ticketBarcode ?? null,
        grower: b.growerNo,
        group: b.group,
        lot: b.lot,
        mass: b.mass,
        timbGrade: b.timbGrade ?? null,
        hessian: b.hessianOwner ?? null,
        buyer: b.buyerCode ?? null,
        buyerGrade: b.buyerGrade ?? null,
        price: b.priceCents ?? null,
        saleCode: b.saleCode ?? null,
        complete: baleIsComplete(b) ? "Yes" : "No",
      }))
      .sort((a, b) => String(a.ticket).localeCompare(String(b.ticket)));
    return {
      columns: [
        { key: "date", header: "Sale date", format: "date" },
        { key: "ticket", header: "Ticket", format: "mono" },
        { key: "grower", header: "Grower", format: "mono" },
        { key: "group", header: "Group", format: "int", align: "right" },
        { key: "lot", header: "Lot", format: "mono" },
        { key: "mass", header: "Mass", format: "mass", align: "right" },
        { key: "timbGrade", header: "TIMB grade / reason", format: "mono" },
        { key: "hessian", header: "Hessian" },
        { key: "buyer", header: "Buyer", format: "mono" },
        { key: "buyerGrade", header: "Buyer grade", format: "mono" },
        { key: "price", header: "Price (US¢/kg)", format: "int", align: "right" },
        { key: "saleCode", header: "Sale code", format: "mono" },
        { key: "complete", header: "Complete" },
      ],
      rows,
      tiles: [
        { label: "Bales", value: formatInt(rows.length) },
        { label: "Complete", value: formatInt(rows.filter((r) => r.complete === "Yes").length) },
        { label: "Awaiting capture", value: formatInt(rows.filter((r) => r.complete === "No").length) },
        { label: "Not bought (sale code)", value: formatInt(rows.filter((r) => r.saleCode).length) },
      ],
      notes: ["Price is US cents per kg (whole number), as captured on e-Buying."],
    };
  },
};

export const salesReport: ReportDef = {
  slug: "sales",
  title: "Sales report",
  description: "Sales (ticket processing): status, bales, mass, gross value, deductions, net payout and pay batch number.",
  area: "Floor & sales",
  filters: ["date", "season", "sellingPoint", "grower", "buyer", "batch", "status"],
  statusLabel: "Sale status",
  statusOptions: SALE_STATES.map((s) => ({ value: s, label: humanise(s) })),
  batchKind: "pay",
  run(db, f): ReportResult {
    const sales = db.sales
      .filter(
        (s) =>
          inRange(s.saleDate, f) &&
          seasonOk(s.saleDate, f) &&
          spOk(s.sellingPointId, f) &&
          growerOk(s.growerNo, f) &&
          (!f.status || s.status === f.status) &&
          (!f.batch || String(s.payBatchNo ?? "") === f.batch) &&
          (!f.buyer || saleBales(db, s).some((b) => b.buyerCode === f.buyer)),
      )
      .sort((a, b) => b.saleDate.localeCompare(a.saleDate) || a.refNo - b.refNo);
    const rows = sales.map((s) => {
      const gross = saleGrossCents(db, s);
      const ded = saleDeductionsCents(db, s);
      return {
        date: s.saleDate,
        sale: `Sale #${s.refNo}`,
        grower: s.growerNo,
        name: growerName(db, s.growerNo),
        gdn: db.deliveryNotes.find((d) => d.id === s.gdnId)?.docNo ?? null,
        status: s.status,
        released: s.released ? "Yes" : "No",
        bales: saleBaleCount(db, s),
        mass: saleMassKg(db, s),
        gross,
        deductions: s.status === "PROCESSED" ? ded : null,
        net: s.status === "PROCESSED" ? gross - ded : null,
        payBatch: s.payBatchNo ?? null,
      };
    });
    const sum = (k: "gross" | "deductions" | "net") => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
    return {
      columns: [
        { key: "date", header: "Sale date", format: "date" },
        { key: "sale", header: "Sale", format: "mono" },
        { key: "grower", header: "Grower", format: "mono" },
        { key: "name", header: "Name" },
        { key: "gdn", header: "Delivery note", format: "mono" },
        { key: "status", header: "Status", format: "status", statusKind: "sale" },
        { key: "released", header: "Released" },
        { key: "bales", header: "Bales", format: "int", align: "right" },
        { key: "mass", header: "Mass", format: "mass", align: "right" },
        { key: "gross", header: "Gross (USD)", format: "amount", align: "right" },
        { key: "deductions", header: "Deductions", format: "amount", align: "right" },
        { key: "net", header: "Net payout", format: "amount", align: "right" },
        { key: "payBatch", header: "Pay batch", format: "mono" },
      ],
      rows,
      tiles: [
        { label: "Sales", value: formatInt(rows.length) },
        { label: "Gross value", value: formatUsd(sum("gross")) },
        { label: "Deductions", value: formatUsd(sum("deductions")), hint: "processed sales only" },
        { label: "Net payout", value: formatUsd(sum("net")), hint: "processed sales only" },
      ],
      notes: [
        "Gross = Σ (price in US cents/kg × mass) per bought ticket. This arithmetic is assumed, not documented (UQ-05); rounding is a placeholder.",
        "Historical demo sales carry aggregate values only, and their deductions are not seeded.",
      ],
    };
  },
};

export const batchProcessingReport: ReportDef = {
  slug: "batch-processing",
  title: "Batch processing report",
  description: "Price batches (second price capture): status, tickets, prices entered and price mismatches against captured prices.",
  area: "Floor & sales",
  filters: ["date", "season", "sellingPoint", "grower", "batch", "status"],
  statusLabel: "Batch status",
  statusOptions: PRICE_BATCH_STATES.map((s) => ({ value: s, label: humanise(s) })),
  batchKind: "price",
  run(db, f): ReportResult {
    const batches = db.priceBatches
      .filter(
        (b) =>
          inRange(b.sellingDate, f) &&
          seasonOk(b.sellingDate, f) &&
          spOk(b.sellingPointId, f) &&
          growerOk(b.growerNo, f) &&
          (!f.status || b.status === f.status) &&
          (!f.batch || String(b.refNo) === f.batch),
      )
      .sort((a, b) => b.sellingDate.localeCompare(a.sellingDate) || a.refNo - b.refNo);
    const rows = batches.map((b) => {
      const sale = db.sales.find((s) => s.id === b.saleId);
      const bales = sale ? saleBales(db, sale) : [];
      const mismatches = bales.filter((x) => !x.saleCode && x.batchPriceCents !== undefined && x.batchPriceCents !== x.priceCents).length;
      return {
        batch: `Batch ${b.refNo}`,
        sale: sale ? `Sale #${sale.refNo}` : null,
        grower: b.growerNo,
        name: growerName(db, b.growerNo),
        date: b.sellingDate,
        status: b.status,
        tickets: sale ? saleBaleCount(db, sale) : 0,
        entered: bales.filter((x) => x.batchPriceCents !== undefined).length,
        mismatches,
        postedBy: b.postedBy ? userNameOf(db, b.postedBy) : null,
        postedAt: b.postedAt ?? null,
      };
    });
    return {
      columns: [
        { key: "batch", header: "Batch", format: "mono" },
        { key: "sale", header: "Sale", format: "mono" },
        { key: "grower", header: "Grower", format: "mono" },
        { key: "name", header: "Name" },
        { key: "date", header: "Selling date", format: "date" },
        { key: "status", header: "Status", format: "status", statusKind: "priceBatch" },
        { key: "tickets", header: "Tickets", format: "int", align: "right" },
        { key: "entered", header: "Prices entered", format: "int", align: "right" },
        { key: "mismatches", header: "Price mismatches", format: "int", align: "right" },
        { key: "postedBy", header: "Posted by" },
        { key: "postedAt", header: "Posted at", format: "datetime" },
      ],
      rows,
      tiles: [
        { label: "Batches", value: formatInt(rows.length) },
        { label: "Posted", value: formatInt(rows.filter((r) => r.status === "POSTED").length) },
        { label: "With price mismatches", value: formatInt(rows.filter((r) => r.mismatches > 0).length) },
      ],
      notes: ["“Price batch” (Batch Processing) is not the “pay batch” number assigned when deductions are processed."],
    };
  },
};
