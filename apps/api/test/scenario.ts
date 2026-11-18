import type { BaleStatus, PrismaClient } from "@prisma/client";

/**
 * A deterministic buyer scenario for the report and dashboard tests (company MZ, plus a little for KT).
 *
 *  Purchase A  22 May 2026  ETHICAL SALES FLOOR  10 bales (8×L4OMA 100 kg @ US$250, 2×L4R 80 kg @ US$160) = 960.0 kg / US$2,320.00
 *     S1  6 bales (b1–b6)  ALLOCATED  received + stored; session R1: 4 weighed (401.0 kg vs 400.0 manifest), 1 open + 1 resolved exception
 *     S2  3 bales (b7–b9)  IN_TRANSIT (b7, b8 L4OMA, b9 L4R)  = 280.0 kg
 *     b10 not on any shipment (EXPECTED)
 *  Purchase B  10 Jun 2026  OTHER FLOOR           5 bales × L4OMA 100 kg @ US$250 = 500.0 kg / US$1,250.00; nothing dispatched
 *  Purchase C  1 Apr 2026   ETHICAL SALES FLOOR   2 bales; S3 ALLOCATED, R3 weighed exactly (no variance); both stored MAIN › BAY-02 › ROW-A
 *
 * On hand (IN_STOCK): b1–b6 (A) and C's two bales = 8 bales / 800.0 kg / US$2,000.00. b6 has no location yet.
 * Bale b3's barcode ends in a blank ("111000003 ") on purpose.
 */
export interface Scenario {
  mz: { orgId: string; adminId: string; purchaseA: string; purchaseB: string; purchaseC: string; invoiceA: string; shipmentS1: string; shipmentS2: string; shipmentS3: string; sessionR1: string; sessionR3: string; baleIds: Record<string, string>; main: Where; sec: Where; proc: Where; mainB2: Where };
  kt: { orgId: string; purchase: string; shipment: string };
  now: Date;
}
export interface Where { warehouseId: string; bayId: string; rowId: string; label: string }

const DAY = 86_400_000;
let seq = 0;
const uniq = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

async function where(prisma: PrismaClient, orgId: string, wh: string, bay: string, row: string): Promise<Where> {
  const w = await prisma.warehouse.findFirstOrThrow({ where: { buyerOrganisationId: orgId, code: wh } });
  const b = await prisma.bay.findFirstOrThrow({ where: { warehouseId: w.id, code: bay } });
  const r = await prisma.warehouseRow.findFirstOrThrow({ where: { bayId: b.id, code: row } });
  return { warehouseId: w.id, bayId: b.id, rowId: r.id, label: `${wh} › ${bay} › ${row}` };
}

interface BaleSpec {
  key: string;
  barcode: string;
  grade: string;
  kg: number;
  usc: number;
  status: BaleStatus;
  receivedAt?: Date;
  at?: Where;
}

export async function buildReportScenario(prisma: PrismaClient, mzId: string, ktId: string): Promise<Scenario> {
  const now = new Date();
  const admin = await prisma.buyerUser.findUniqueOrThrow({ where: { email: "admin@moroz-demo.test" } });
  const ktAdmin = await prisma.buyerUser.findUniqueOrThrow({ where: { email: "admin@kt-demo.test" } });
  const main = await where(prisma, mzId, "MAIN", "BAY-01", "ROW-A");
  const mainB = await where(prisma, mzId, "MAIN", "BAY-01", "ROW-B");
  const mainB2 = await where(prisma, mzId, "MAIN", "BAY-02", "ROW-A");
  const sec = await where(prisma, mzId, "SEC", "BAY-01", "ROW-A");
  const proc = await where(prisma, mzId, "PROC", "BAY-01", "ROW-A");
  const destination = main.warehouseId;
  const usd = (kg: number, usc: number) => ((kg * usc) / 100).toFixed(2);

  async function purchase(opts: {
    orgId: string;
    code: string;
    createdById: string;
    floor: string;
    saleDate: string;
    invoiceNumber: string | null;
    receivingStatus: "NOT_STARTED" | "PARTIALLY_RECEIVED" | "COMPLETE";
    reconciliation: "AWAITING_SHIPMENTS" | "IN_PROGRESS" | "CLOSED";
    bales: BaleSpec[];
    charges?: boolean;
  }) {
    const ref = uniq();
    const kg = opts.bales.reduce((s, b) => s + b.kg, 0);
    const value = opts.bales.reduce((s, b) => s + Number(usd(b.kg, b.usc)), 0);
    const invoice = await prisma.buyerInvoice.create({
      data: {
        buyerOrganisationId: opts.orgId,
        invoiceNumber: opts.invoiceNumber,
        reference: `BINV-${opts.code}-${ref}`,
        floorName: opts.floor,
        buyerNameOnInvoice: `${opts.code} TEST`,
        saleDateFrom: new Date(`${opts.saleDate}T00:00:00Z`),
        saleDateTo: new Date(`${opts.saleDate}T00:00:00Z`),
        invoiceDate: new Date(`${opts.saleDate}T00:00:00Z`),
        exchangeRate: "26.3216",
        totalBales: opts.bales.length,
        totalMassKg: kg.toFixed(1),
        avgUscPerKg: ((value / kg) * 100).toFixed(2),
        totalUsdValue: value.toFixed(2),
        ...(opts.charges
          ? {
              totalZigValue: "61000.00",
              payableUsd: "1631.50",
              payableZig: "20340.00",
              charges: {
                create: [
                  { status: "A", code: "TOBACCO_VALUE", label: "TOBACCO VALUE", amountUsd: "2320.00", amountZig: "61000.00", sortOrder: 1 },
                  { status: "B", code: "CURRENCY_SPLIT", label: "USD ZiG Split", amountUsd: "1624.00", amountZig: "18300.00", sortOrder: 2 },
                  { status: "B", code: "BUYER_GOVERNMENT_LEVY", label: "BUYER GOVERNMENT LEVY", amountUsd: "0.00", amountZig: "1500.00", sortOrder: 3 },
                  { status: "B", code: "TTA_LEVY", label: "TTA LEVY", amountUsd: "7.50", amountZig: "90.00", sortOrder: 4 },
                  { status: "B", code: "FLOOR_CLEARING", label: "FLOOR CLEARING", amountUsd: "0.00", amountZig: "450.00", sortOrder: 5 },
                ],
              },
            }
          : {}),
      },
    });
    const p = await prisma.purchase.create({
      data: {
        buyerOrganisationId: opts.orgId,
        invoiceId: invoice.id,
        reference: `PUR-${opts.code}-${ref}`,
        floorName: opts.floor,
        saleDate: new Date(`${opts.saleDate}T00:00:00Z`),
        totalBales: opts.bales.length,
        totalMassKg: kg.toFixed(1),
        totalUsdValue: value.toFixed(2),
        receivingStatus: opts.receivingStatus,
      },
    });
    await prisma.purchaseReconciliation.create({ data: { buyerOrganisationId: opts.orgId, purchaseId: p.id, status: opts.reconciliation } });
    const ids: Record<string, string> = {};
    for (const b of opts.bales) {
      const bale = await prisma.bale.create({
        data: {
          buyerOrganisationId: opts.orgId,
          purchaseId: p.id,
          barcode: b.barcode,
          season: 2026,
          buyerGrade: b.grade,
          timbGrade: "L4OK",
          growerNo: "349376",
          lotNo: "0057",
          massKg: b.kg.toFixed(1),
          uscPerKg: b.usc.toFixed(2),
          usdValue: usd(b.kg, b.usc),
          status: b.status,
          receivedAt: b.receivedAt ?? null,
          currentWarehouseId: b.at?.warehouseId ?? null,
          currentBayId: b.at?.bayId ?? null,
          currentRowId: b.at?.rowId ?? null,
        },
      });
      ids[b.key] = bale.id;
    }
    return { purchase: p, invoice, ids };
  }

  async function shipment(opts: {
    orgId: string;
    purchaseId: string;
    createdById: string;
    reference: string;
    dispatchDate: string;
    status: "IN_TRANSIT" | "ALLOCATED";
    truck: string;
    driver: string;
    arrivedAt?: Date;
    lines: Array<{ baleId: string; kg: number }>;
  }) {
    const s = await prisma.buyerShipment.create({
      data: {
        buyerOrganisationId: opts.orgId,
        purchaseId: opts.purchaseId,
        reference: `${opts.reference}-${uniq()}`,
        dispatchDate: new Date(`${opts.dispatchDate}T00:00:00Z`),
        destinationWarehouseId: destination,
        truckRegistration: opts.truck,
        trailerRegistration: "TRL 1",
        driverName: opts.driver,
        transporter: "Acme Haulage",
        status: opts.status,
        expectedBales: opts.lines.length,
        expectedMassKg: opts.lines.reduce((t, l) => t + l.kg, 0).toFixed(1),
        arrivedAt: opts.arrivedAt ?? null,
        confirmedAt: opts.status === "ALLOCATED" ? opts.arrivedAt : null,
        allocatedAt: opts.status === "ALLOCATED" ? opts.arrivedAt : null,
        createdById: opts.createdById,
      },
    });
    for (const l of opts.lines) {
      await prisma.buyerShipmentBale.create({
        data: {
          buyerOrganisationId: opts.orgId,
          shipmentId: s.id,
          baleId: l.baleId,
          massKgAtDispatch: l.kg.toFixed(1),
          status: opts.status === "ALLOCATED" ? "ALLOCATED" : "EXPECTED",
          receivedAt: opts.status === "ALLOCATED" ? opts.arrivedAt : null,
          allocatedAt: opts.status === "ALLOCATED" ? opts.arrivedAt : null,
        },
      });
    }
    return s;
  }

  // ── Purchase A ─────────────────────────────────────────────────────────────
  const A = await purchase({
    orgId: mzId,
    code: "MZ",
    createdById: admin.id,
    floor: "ETHICAL SALES FLOOR",
    saleDate: "2026-05-22",
    invoiceNumber: "INV-A-001",
    receivingStatus: "PARTIALLY_RECEIVED",
    reconciliation: "IN_PROGRESS",
    charges: true,
    bales: [
      { key: "b1", barcode: "1110000001", grade: "L4OMA", kg: 100, usc: 250, status: "IN_STOCK", receivedAt: new Date(now.getTime() - 3_600_000), at: main },
      { key: "b2", barcode: "1110000002", grade: "L4OMA", kg: 100, usc: 250, status: "IN_STOCK", receivedAt: new Date(now.getTime() - 7_200_000), at: mainB },
      { key: "b3", barcode: "111000003 ", grade: "L4OMA", kg: 100, usc: 250, status: "IN_STOCK", receivedAt: new Date(now.getTime() - 10 * DAY), at: main },
      { key: "b4", barcode: "1110000004", grade: "L4OMA", kg: 100, usc: 250, status: "IN_STOCK", receivedAt: new Date(now.getTime() - 10 * DAY), at: mainB },
      { key: "b5", barcode: "1110000005", grade: "L4OMA", kg: 100, usc: 250, status: "IN_STOCK", receivedAt: new Date(now.getTime() - 45 * DAY), at: sec },
      { key: "b6", barcode: "1110000006", grade: "L4OMA", kg: 100, usc: 250, status: "IN_STOCK", receivedAt: new Date(now.getTime() - 100 * DAY) },
      { key: "b7", barcode: "1110000007", grade: "L4OMA", kg: 100, usc: 250, status: "DISPATCHED" },
      { key: "b8", barcode: "1110000008", grade: "L4OMA", kg: 100, usc: 250, status: "DISPATCHED" },
      { key: "b9", barcode: "1110000009", grade: "L4R", kg: 80, usc: 200, status: "DISPATCHED" },
      { key: "b10", barcode: "1110000010", grade: "L4R", kg: 80, usc: 200, status: "EXPECTED" },
    ],
  });
  const a = A.ids;
  const s1 = await shipment({
    orgId: mzId,
    purchaseId: A.purchase.id,
    createdById: admin.id,
    reference: "SHP-A1",
    dispatchDate: "2026-05-23",
    status: "ALLOCATED",
    truck: "TRK 9900",
    driver: "Tendai",
    arrivedAt: new Date("2026-05-25T08:00:00Z"),
    lines: ["b1", "b2", "b3", "b4", "b5", "b6"].map((k) => ({ baleId: a[k]!, kg: 100 })),
  });
  const s2 = await shipment({
    orgId: mzId,
    purchaseId: A.purchase.id,
    createdById: admin.id,
    reference: "SHP-A2",
    dispatchDate: "2026-05-28",
    status: "IN_TRANSIT",
    truck: "ABC 1234",
    driver: "Farai",
    lines: [{ baleId: a.b7!, kg: 100 }, { baleId: a.b8!, kg: 100 }, { baleId: a.b9!, kg: 80 }],
  });

  const r1 = await prisma.receivingSession.create({
    data: { buyerOrganisationId: mzId, purchaseId: A.purchase.id, shipmentId: s1.id, reference: `RCV-A-${uniq()}`, status: "ALLOCATED", startedById: admin.id, startedAt: new Date("2026-05-25T09:00:00Z"), confirmedById: admin.id, confirmedAt: new Date("2026-05-25T10:15:00Z") },
  });
  const weights: Record<string, number | null> = { b1: 101.0, b2: 99.5, b3: 100.5, b4: 100.0, b5: null, b6: null };
  for (const [key, kg] of Object.entries(weights)) {
    await prisma.receivingScan.create({
      data: { buyerOrganisationId: mzId, sessionId: r1.id, barcode: key === "b3" ? "111000003 " : `111000000${key.slice(1)}`.slice(-10), result: "RECEIVED", baleId: a[key]!, massKg: kg === null ? null : kg.toFixed(1), scannedById: admin.id, scannedAt: new Date("2026-05-25T09:30:00Z") },
    });
  }
  await prisma.receivingException.create({
    data: { buyerOrganisationId: mzId, sessionId: r1.id, barcode: "9990000001", kind: "UNEXPECTED", explanation: "Bale not on the manifest", status: "OPEN", raisedById: admin.id, raisedAt: new Date("2026-05-25T09:40:00Z") },
  });
  await prisma.receivingException.create({
    data: { buyerOrganisationId: mzId, sessionId: r1.id, barcode: "9990000002", kind: "WRONG_PURCHASE", explanation: "Belongs to another purchase", status: "RESOLVED", raisedById: admin.id, raisedAt: new Date("2026-05-25T09:41:00Z"), resolvedById: admin.id, resolvedAt: new Date("2026-05-25T09:50:00Z"), resolution: "Returned to the dock" },
  });

  const move = (baleId: string, type: "STORE" | "MOVE", to: Where, from: Where | null, at: string, refId?: string) =>
    prisma.baleMovement.create({
      data: {
        buyerOrganisationId: mzId,
        baleId,
        type,
        fromWarehouseId: from?.warehouseId ?? null,
        fromBayId: from?.bayId ?? null,
        fromRowId: from?.rowId ?? null,
        toWarehouseId: to.warehouseId,
        toBayId: to.bayId,
        toRowId: to.rowId,
        reason: type === "STORE" ? "Stored on receiving" : "Consolidation",
        performedById: admin.id,
        performedAt: new Date(at),
        refType: type === "STORE" ? "RECEIVING_SESSION" : "MANUAL",
        refId: type === "STORE" ? refId : undefined,
      },
    });
  await move(a.b1!, "STORE", main, null, "2026-05-25T09:35:00Z", r1.id);
  await move(a.b2!, "STORE", main, null, "2026-05-25T09:36:00Z", r1.id);
  await move(a.b2!, "MOVE", mainB, main, "2026-05-25T11:00:00Z");
  await move(a.b3!, "STORE", main, null, "2026-05-25T09:37:00Z", r1.id);
  await move(a.b4!, "STORE", mainB, null, "2026-05-25T09:38:00Z", r1.id);
  await move(a.b5!, "STORE", sec, null, "2026-05-25T09:39:00Z", r1.id);

  // ── Purchase B (nothing dispatched) ────────────────────────────────────────
  const B = await purchase({
    orgId: mzId,
    code: "MZ",
    createdById: admin.id,
    floor: "OTHER FLOOR",
    saleDate: "2026-06-10",
    invoiceNumber: null,
    receivingStatus: "NOT_STARTED",
    reconciliation: "AWAITING_SHIPMENTS",
    bales: [1, 2, 3, 4, 5].map((i) => ({ key: `x${i}`, barcode: `11100001${String(i).padStart(2, "0")}`, grade: "L4OMA", kg: 100, usc: 250, status: "EXPECTED" as const })),
  });

  // ── Purchase C (fully received, weighed exactly) ───────────────────────────
  const cReceived = new Date(now.getTime() - 200 * DAY);
  const C = await purchase({
    orgId: mzId,
    code: "MZ",
    createdById: admin.id,
    floor: "ETHICAL SALES FLOOR",
    saleDate: "2026-04-01",
    invoiceNumber: "INV-C-001",
    receivingStatus: "COMPLETE",
    reconciliation: "CLOSED",
    bales: [1, 2].map((i) => ({ key: `c${i}`, barcode: `11100002${String(i).padStart(2, "0")}`, grade: "L4OMA", kg: 100, usc: 250, status: "IN_STOCK" as const, receivedAt: cReceived, at: mainB2 })),
  });
  const s3 = await shipment({
    orgId: mzId,
    purchaseId: C.purchase.id,
    createdById: admin.id,
    reference: "SHP-C1",
    dispatchDate: "2026-04-02",
    status: "ALLOCATED",
    truck: "CCC 3333",
    driver: "Chipo",
    arrivedAt: new Date("2026-04-02T07:00:00Z"),
    lines: [{ baleId: C.ids.c1!, kg: 100 }, { baleId: C.ids.c2!, kg: 100 }],
  });
  const r3 = await prisma.receivingSession.create({
    // 22:30 UTC on 2 April is 00:30 on 3 April in Harare — the day-boundary test relies on this
    data: { buyerOrganisationId: mzId, purchaseId: C.purchase.id, shipmentId: s3.id, reference: `RCV-C-${uniq()}`, status: "ALLOCATED", startedById: admin.id, startedAt: new Date("2026-04-02T22:30:00Z"), confirmedById: admin.id, confirmedAt: new Date("2026-04-02T23:00:00Z") },
  });
  for (const key of ["c1", "c2"]) {
    await prisma.receivingScan.create({
      data: { buyerOrganisationId: mzId, sessionId: r3.id, barcode: key === "c1" ? "1110000201" : "1110000202", result: "RECEIVED", baleId: C.ids[key]!, massKg: "100.0", scannedById: admin.id, scannedAt: new Date("2026-04-02T22:40:00Z") },
    });
    await move(C.ids[key]!, "STORE", mainB2, null, "2026-04-02T12:00:00Z", r3.id);
  }

  // ── Flow Disk imports ──────────────────────────────────────────────────────
  const importBase = { buyerOrganisationId: mzId, parserId: "flowdisk-v0", parserVersion: "0", formatVerified: false, header: {}, stagedRows: [], createdById: admin.id };
  await prisma.flowDiskImport.create({
    data: { ...importBase, reference: `IMP-${uniq()}`, status: "COMPLETED", filename: "MZ_20260522.csv", fileSha256: `sha-${uniq()}`, recordCount: 10, validCount: 10, invalidCount: 0, expectedMassKg: "960.0", expectedUsdValue: "2320.00", invoiceId: A.invoice.id, purchaseId: A.purchase.id, confirmedAt: new Date("2026-05-24T08:00:00Z") },
  });
  await prisma.flowDiskImport.create({
    data: { ...importBase, reference: `IMP-${uniq()}`, status: "STAGED", filename: "MZ_staged.csv", fileSha256: `sha-${uniq()}`, recordCount: 5, validCount: 4, invalidCount: 1, expectedMassKg: "500.0", expectedUsdValue: "1250.00" },
  });

  // ── KT (another company: its data must never appear in MZ's reports) ───────
  const ktWh = await prisma.warehouse.findFirstOrThrow({ where: { buyerOrganisationId: ktId, code: "MAIN" } });
  const ktP = await purchase({
    orgId: ktId,
    code: "KT",
    createdById: ktAdmin.id,
    floor: "ETHICAL SALES FLOOR",
    saleDate: "2026-05-22",
    invoiceNumber: "INV-KT-001",
    receivingStatus: "NOT_STARTED",
    reconciliation: "IN_PROGRESS",
    bales: [1, 2, 3].map((i) => ({ key: `k${i}`, barcode: `22200000${String(i).padStart(2, "0")}`, grade: "L4OMA", kg: 100, usc: 250, status: "DISPATCHED" as const })),
  });
  const ktShipment = await prisma.buyerShipment.create({
    data: { buyerOrganisationId: ktId, purchaseId: ktP.purchase.id, reference: `SHP-KT-${uniq()}`, dispatchDate: new Date("2026-05-23T00:00:00Z"), destinationWarehouseId: ktWh.id, truckRegistration: "KT 111", driverName: "Kuda", status: "IN_TRANSIT", expectedBales: 3, expectedMassKg: "300.0", createdById: ktAdmin.id },
  });
  for (const key of ["k1", "k2", "k3"]) {
    await prisma.buyerShipmentBale.create({ data: { buyerOrganisationId: ktId, shipmentId: ktShipment.id, baleId: ktP.ids[key]!, massKgAtDispatch: "100.0", status: "EXPECTED" } });
  }

  return {
    mz: {
      orgId: mzId,
      adminId: admin.id,
      purchaseA: A.purchase.id,
      purchaseB: B.purchase.id,
      purchaseC: C.purchase.id,
      invoiceA: A.invoice.id,
      shipmentS1: s1.id,
      shipmentS2: s2.id,
      shipmentS3: s3.id,
      sessionR1: r1.id,
      sessionR3: r3.id,
      baleIds: { ...a, ...B.ids, ...C.ids },
      main,
      sec,
      proc,
      mainB2,
    },
    kt: { orgId: ktId, purchase: ktP.purchase.id, shipment: ktShipment.id },
    now,
  };
}
