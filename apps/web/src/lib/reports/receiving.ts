import { DELIVERY_NOTE_STATES, DELIVERY_NOTE_STATE_LABEL, formatInt, type MockDb } from "@tobacco/shared";
import { growerName, growerOk, inRange, liveBales, seasonOk, spOk, userNameOf } from "./helpers";
import type { ReportDef, ReportFilters, ReportResult } from "./types";

const stateOptions = DELIVERY_NOTE_STATES.map((s) => ({ value: s, label: DELIVERY_NOTE_STATE_LABEL[s] }));

function notesFor(db: MockDb, f: ReportFilters) {
  return db.deliveryNotes.filter(
    (n) =>
      inRange(n.sellingDate, f) &&
      seasonOk(n.sellingDate, f) &&
      spOk(n.sellingPointId, f) &&
      growerOk(n.growerNo, f) &&
      (!f.status || n.state === f.status),
  );
}

const capturedCount = (db: MockDb, n: { id: string; historicalBaleCount?: number }) => n.historicalBaleCount ?? liveBales(db, n.id).length;

function noteMass(db: MockDb, n: { id: string; historicalBaleCount?: number }): number | null {
  if (n.historicalBaleCount !== undefined) {
    const sale = db.sales.find((s) => s.gdnId === n.id);
    return sale?.historical?.massKg ?? null;
  }
  return liveBales(db, n.id).reduce((a, b) => a + b.mass, 0);
}

export const dailyReceiving: ReportDef = {
  slug: "daily-receiving",
  title: "Daily receiving report",
  description: "Every grower delivery received on the selected day(s): truck, grower, declared and captured bales, mass and state.",
  area: "Receiving & tickets",
  filters: ["date", "season", "sellingPoint", "grower", "status"],
  statusLabel: "Delivery state",
  statusOptions: stateOptions,
  defaultFilters: (db) => ({ from: db.settings.demoToday, to: db.settings.demoToday }),
  run(db, f): ReportResult {
    const notes = notesFor(db, f).sort((a, b) => b.sellingDate.localeCompare(a.sellingDate) || a.docNo.localeCompare(b.docNo));
    const rows = notes.map((n) => {
      const tdn = n.transporterNoteId ? db.transporterNotes.find((t) => t.id === n.transporterNoteId) : undefined;
      return {
        date: n.sellingDate,
        tdn: tdn?.docNo ?? null,
        transporter: tdn?.transporterName ?? null,
        vehicle: tdn?.vehicleReg ?? null,
        gdn: n.docNo,
        grower: n.growerNo,
        name: growerName(db, n.growerNo),
        location: n.location,
        declared: n.balesDeclared,
        captured: capturedCount(db, n),
        mass: noteMass(db, n),
        state: n.state,
      };
    });
    const trucks = new Set(rows.map((r) => r.tdn).filter(Boolean));
    const growers = new Set(rows.map((r) => r.grower));
    const bales = rows.reduce((a, r) => a + Number(r.captured), 0);
    const mass = rows.reduce((a, r) => a + Number(r.mass ?? 0), 0);
    return {
      columns: [
        { key: "date", header: "Date", format: "date" },
        { key: "tdn", header: "Truck note", format: "mono" },
        { key: "transporter", header: "Transporter" },
        { key: "vehicle", header: "Vehicle", format: "mono" },
        { key: "gdn", header: "Delivery note", format: "mono" },
        { key: "grower", header: "Grower", format: "mono" },
        { key: "name", header: "Name" },
        { key: "location", header: "Loc." },
        { key: "declared", header: "Declared", format: "int", align: "right" },
        { key: "captured", header: "Captured", format: "int", align: "right" },
        { key: "mass", header: "Mass", format: "mass", align: "right" },
        { key: "state", header: "State", format: "status", statusKind: "deliveryNote" },
      ],
      rows,
      tiles: [
        { label: "Trucks", value: formatInt(trucks.size) },
        { label: "Growers", value: formatInt(growers.size) },
        { label: "Bales captured", value: formatInt(bales) },
        { label: "Total mass", value: `${mass.toLocaleString("en-US")} kg` },
      ],
      notes: ["Mass for historical demo deliveries is the aggregate on the processed sale; bale-level detail is not seeded for them."],
    };
  },
};

export const growerDelivery: ReportDef = {
  slug: "grower-delivery",
  title: "Grower delivery report",
  description: "Bales booked with TIMB against bales delivered and captured, per grower — highlights unbooked bales.",
  area: "Receiving & tickets",
  filters: ["date", "season", "sellingPoint", "grower"],
  run(db, f): ReportResult {
    const bookings = db.bookings.filter((b) => inRange(b.sellDate, f) && seasonOk(b.sellDate, f) && spOk(b.floor, f) && growerOk(b.growerNo, f));
    const notes = notesFor(db, f).filter((n) => n.state !== "OPEN");
    const growers = [...new Set([...bookings.map((b) => b.growerNo), ...notes.map((n) => n.growerNo)])].sort();
    const rows = growers.map((g) => {
      const booked = bookings.filter((b) => b.growerNo === g).reduce((a, b) => a + b.balesBooked, 0);
      const mine = notes.filter((n) => n.growerNo === g);
      const delivered = mine.reduce((a, n) => a + n.balesDeclared, 0);
      return {
        grower: g,
        name: growerName(db, g),
        booked,
        deliveries: mine.length,
        delivered,
        captured: mine.reduce((a, n) => a + capturedCount(db, n), 0),
        mass: mine.reduce((a, n) => a + Number(noteMass(db, n) ?? 0), 0) || null,
        unbooked: Math.max(0, delivered - booked),
      };
    });
    return {
      columns: [
        { key: "grower", header: "Grower", format: "mono" },
        { key: "name", header: "Name" },
        { key: "booked", header: "Booked", format: "int", align: "right" },
        { key: "deliveries", header: "Deliveries", format: "int", align: "right" },
        { key: "delivered", header: "Delivered", format: "int", align: "right" },
        { key: "captured", header: "Captured", format: "int", align: "right" },
        { key: "mass", header: "Mass", format: "mass", align: "right" },
        { key: "unbooked", header: "Unbooked", format: "int", align: "right" },
      ],
      rows,
      tiles: [
        { label: "Growers", value: formatInt(rows.length) },
        { label: "Bales booked", value: formatInt(rows.reduce((a, r) => a + r.booked, 0)) },
        { label: "Bales delivered", value: formatInt(rows.reduce((a, r) => a + r.delivered, 0)) },
        { label: "Unbooked bales", value: formatInt(rows.reduce((a, r) => a + r.unbooked, 0)) },
      ],
      notes: ["Whether unbooked bales block receiving or only warn is unverified (UQ-09); this report simply shows them."],
    };
  },
};

export const baleReceiving: ReportDef = {
  slug: "bale-receiving",
  title: "Bale receiving report",
  description: "Every captured bale: scale barcode, group, lot, mass, who captured it and whether it was later ejected.",
  area: "Receiving & tickets",
  filters: ["date", "season", "grower", "status"],
  statusLabel: "Bale status",
  statusOptions: [
    { value: "CAPTURED", label: "Captured" },
    { value: "EJECTED", label: "Ejected" },
  ],
  run(db, f): ReportResult {
    const bales = db.bales
      .filter((b) => inRange(b.capturedAt, f) && seasonOk(b.capturedAt, f) && growerOk(b.growerNo, f) && (!f.status || (f.status === "EJECTED") === b.ejected))
      .sort((a, b) => a.scaleBarcode.localeCompare(b.scaleBarcode));
    const rows = bales.map((b) => ({
      scale: b.scaleBarcode,
      ticket: b.ticketBarcode ?? null,
      grower: b.growerNo,
      gdn: db.deliveryNotes.find((d) => d.id === b.gdnId)?.docNo ?? null,
      group: b.group,
      lot: b.lot,
      mass: b.mass,
      by: userNameOf(db, b.capturedBy),
      at: b.capturedAt,
      status: b.ejected ? "Ejected" : "Captured",
    }));
    return {
      columns: [
        { key: "scale", header: "Scale barcode", format: "mono" },
        { key: "ticket", header: "Ticket barcode", format: "mono" },
        { key: "grower", header: "Grower", format: "mono" },
        { key: "gdn", header: "Delivery note", format: "mono" },
        { key: "group", header: "Group", format: "int", align: "right" },
        { key: "lot", header: "Lot", format: "mono" },
        { key: "mass", header: "Mass", format: "mass", align: "right" },
        { key: "by", header: "Captured by" },
        { key: "at", header: "Captured at", format: "datetime" },
        { key: "status", header: "Status" },
      ],
      rows,
      tiles: [
        { label: "Bales captured", value: formatInt(bales.filter((b) => !b.ejected).length) },
        { label: "Total mass", value: `${bales.filter((b) => !b.ejected).reduce((a, b) => a + b.mass, 0).toLocaleString("en-US")} kg` },
        { label: "Ejected", value: formatInt(bales.filter((b) => b.ejected).length) },
      ],
      notes: ["Historical demo deliveries carry no bale rows."],
    };
  },
};

export const ticketPrinting: ReportDef = {
  slug: "ticket-printing",
  title: "Ticket printing report",
  description: "Ticket barcodes allocated to bales, whether printed, and the print/confirm history.",
  area: "Receiving & tickets",
  filters: ["date", "season", "grower", "status"],
  statusLabel: "Ticket state",
  statusOptions: [
    { value: "PRINTED", label: "Printed" },
    { value: "ALLOCATED", label: "Allocated, not printed" },
  ],
  run(db, f): ReportResult {
    const bales = db.bales
      .filter(
        (b) =>
          b.ticketBarcode &&
          !b.ejected &&
          inRange(b.ticketDate ?? b.capturedAt, f) &&
          seasonOk(b.ticketDate ?? b.capturedAt, f) &&
          growerOk(b.growerNo, f) &&
          (!f.status || (f.status === "PRINTED") === b.printed),
      )
      .sort((a, b) => (a.ticketBarcode ?? "").localeCompare(b.ticketBarcode ?? ""));
    const rows = bales.map((b) => {
      const gdn = db.deliveryNotes.find((d) => d.id === b.gdnId);
      return {
        ticket: b.ticketBarcode ?? null,
        scale: b.scaleBarcode,
        grower: b.growerNo,
        gdn: gdn?.docNo ?? null,
        group: b.group,
        lot: b.lot,
        mass: b.mass,
        ticketDate: b.ticketDate ?? null,
        printed: b.printed ? "Yes" : "No",
        state: gdn?.state ?? null,
      };
    });
    const events = db.ticketEvents.filter((e) => inRange(e.at, f));
    return {
      columns: [
        { key: "ticket", header: "Ticket barcode", format: "mono" },
        { key: "scale", header: "Scale barcode", format: "mono" },
        { key: "grower", header: "Grower", format: "mono" },
        { key: "gdn", header: "Delivery note", format: "mono" },
        { key: "group", header: "Group", format: "int", align: "right" },
        { key: "lot", header: "Lot", format: "mono" },
        { key: "mass", header: "Mass", format: "mass", align: "right" },
        { key: "ticketDate", header: "Ticket date", format: "date" },
        { key: "printed", header: "Printed" },
        { key: "state", header: "Delivery state", format: "status", statusKind: "deliveryNote" },
      ],
      rows,
      tiles: [
        { label: "Tickets allocated", value: formatInt(rows.length) },
        { label: "Printed", value: formatInt(bales.filter((b) => b.printed).length) },
        { label: "Print events", value: formatInt(events.length), hint: "allocate · print · confirm · reverse" },
      ],
      notes: ["A ticket range such as 1000001013 – 1000001035 covers 3 tickets (each ticket carries its own check character), not 23."],
    };
  },
};

export const floorSummaryReport: ReportDef = {
  slug: "floor-summary",
  title: "Floor summary report",
  description: "Each grower's floor summary: row, groups, total bales and unbooked bales.",
  area: "Receiving & tickets",
  filters: ["date", "season", "sellingPoint", "grower"],
  run(db, f): ReportResult {
    const sums = db.floorSummaries
      .filter((s) => inRange(s.sellingDate, f) && seasonOk(s.sellingDate, f) && spOk(s.sellingPointId, f) && growerOk(s.growerNo, f))
      .sort((a, b) => b.sellingDate.localeCompare(a.sellingDate) || a.row - b.row);
    const rows = sums.map((s) => ({
      date: s.sellingDate,
      grower: s.growerNo,
      name: growerName(db, s.growerNo),
      gdn: db.deliveryNotes.find((d) => d.id === s.gdnId)?.docNo ?? null,
      row: s.row,
      groups: `${s.groupFirst}–${s.groupLast}`,
      bales: s.totalBales,
      unbooked: s.unbooked,
      district: s.district,
      time: s.sellingTime ?? null,
    }));
    return {
      columns: [
        { key: "date", header: "Selling date", format: "date" },
        { key: "grower", header: "Grower", format: "mono" },
        { key: "name", header: "Name" },
        { key: "gdn", header: "Delivery note", format: "mono" },
        { key: "row", header: "Row", format: "int", align: "right" },
        { key: "groups", header: "Groups" },
        { key: "bales", header: "Total bales", format: "int", align: "right" },
        { key: "unbooked", header: "Unbooked", format: "int", align: "right" },
        { key: "district", header: "District", format: "int", align: "right" },
        { key: "time", header: "Selling time" },
      ],
      rows,
      tiles: [
        { label: "Floor summaries", value: formatInt(rows.length) },
        { label: "Bales on the floor", value: formatInt(rows.reduce((a, r) => a + r.bales, 0)) },
        { label: "Rows used", value: formatInt(new Set(rows.map((r) => r.row)).size) },
      ],
      notes: ["“Selling time” is shown as recorded; its meaning is not documented (UQ-10)."],
    };
  },
};
