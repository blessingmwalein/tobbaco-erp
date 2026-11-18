import type { BuyerDashboardDto } from "@tobacco/shared";
import { API, bearer, boot, describeDb, loginBuyer, loginStaff, type Harness } from "./helpers";
import { buildReportScenario, type Scenario } from "./scenario";

describeDb("buyer dashboard (real HTTP + real database)", () => {
  let h: Harness;
  let s: Scenario;
  let admin: string, viewer: string, kt: string;

  beforeAll(async () => {
    h = await boot();
    s = await buildReportScenario(h.prisma, h.seed.mzId, h.seed.ktId);
    admin = bearer(await loginBuyer(h, "admin@moroz-demo.test"));
    viewer = bearer(await loginBuyer(h, "viewer@moroz-demo.test"));
    kt = bearer(await loginBuyer(h, "admin@kt-demo.test"));
  });
  afterAll(async () => {
    await h?.close();
  });

  const get = (token: string, query: Record<string, string> = {}) => h.http().get(`${API}/buyer/dashboard`).query(query).set("Authorization", token);
  const dash = async (query: Record<string, string> = {}, token = admin): Promise<BuyerDashboardDto> => (await get(token, query).expect(200)).body;

  it("shows the correct purchase, receiving, stock and money figures", async () => {
    const d = await dash();
    expect(d.summary).toMatchObject({
      purchaseCount: 3,
      purchasedBales: 17,
      purchasedMassKg: "1660.0",
      totalSpendUsd: "4070.00",
      receivedBales: 8,
      receivedMassKg: "800.0",
      pendingReceiptBales: 9, // purchased − received
      inventoryBales: 7, // in a warehouse location now (not the 8th, which has no location yet; not EXPECTED bales)
      unallocatedReceivedBales: 1,
      leviesUsd: "7.50", // TTA only: the USD/ZiG split and the tobacco value are not costs
      leviesZig: "2040.00", // 1500.00 + 90.00 + 450.00
      payableUsd: "1631.50",
      payableZig: "20340.00",
      openReceivingSessions: 0,
      openExceptions: 1,
    });
    expect(d.period).toEqual({ firstSaleDate: "2026-04-01", lastSaleDate: "2026-06-10" });
    expect(d.floorOptions).toEqual(["ETHICAL SALES FLOOR", "OTHER FLOOR"]);
    expect(d.recentPurchases.map((p) => p.saleDate)).toEqual(["2026-06-10", "2026-05-22", "2026-04-01"]);
    expect(d.recentPurchases[1]).toMatchObject({ totalBales: 10, totalUsdValue: "2320.00", receivingStatus: "PARTIALLY_RECEIVED" });
  });

  it("does not count EXPECTED or in-transit bales as stock", async () => {
    const d = await dash();
    // 17 purchased: 8 received (7 located + 1 unlocated), 3 in transit and 6 expected → none of those 9 is inventory
    expect(d.summary.inventoryBales + d.summary.unallocatedReceivedBales).toBe(8);
    expect(d.summary.pendingReceiptBales).toBe(9);
  });

  describe("shipments", () => {
    it("shows what is on the road right now", async () => {
      const d = await dash();
      expect(d.shipments.inTransit).toMatchObject({ count: 1, bales: 3, massKg: "280.0" });
      expect(d.shipments.inTransit.items[0]).toMatchObject({ truck: "ABC 1234 / TRL 1", dispatchDate: "2026-05-28", expectedBales: 3, receivedBales: 0, status: "IN_TRANSIT" });
      expect(d.shipments.inTransit.items[0]!.daysSinceDispatch).toBeGreaterThan(100);
      expect(d.shipments.arrived.count).toBe(0);
      expect(d.shipments.receiving.count).toBe(0);
      expect(d.shipments.awaitingStorage.count).toBe(0);
      expect(d.shipments.completed).toEqual({ count: 2, bales: 8 });
    });

    it("moves a shipment through arrived → being received → awaiting storage", async () => {
      const line = await h.prisma.buyerShipmentBale.findFirstOrThrow({ where: { shipmentId: s.mz.shipmentS2, baleId: s.mz.baleIds.b7 } });
      let sessionId: string | undefined;
      try {
        await h.prisma.buyerShipment.update({ where: { id: s.mz.shipmentS2 }, data: { status: "ARRIVED", arrivedAt: new Date() } });
        let d = await dash();
        expect(d.shipments.inTransit.count).toBe(0);
        expect(d.shipments.arrived).toMatchObject({ count: 1, bales: 3 });
        expect(d.shipments.arrived.items[0]!.arrivedAt).not.toBeNull();

        // a receiving session starts scanning it: 2 bales scanned, 1 of them already received on the manifest
        await h.prisma.buyerShipment.update({ where: { id: s.mz.shipmentS2 }, data: { status: "RECEIVING" } });
        const session = await h.prisma.receivingSession.create({
          data: { buyerOrganisationId: s.mz.orgId, purchaseId: s.mz.purchaseA, shipmentId: s.mz.shipmentS2, reference: "RCV-DASH-LIVE", status: "OPEN", startedById: s.mz.adminId },
        });
        sessionId = session.id;
        for (const key of ["b7", "b8"]) {
          await h.prisma.receivingScan.create({ data: { buyerOrganisationId: s.mz.orgId, sessionId: session.id, barcode: key === "b7" ? "1110000007" : "1110000008", result: "RECEIVED", baleId: s.mz.baleIds[key]!, scannedById: s.mz.adminId } });
        }
        await h.prisma.buyerShipmentBale.update({ where: { id: line.id }, data: { status: "RECEIVED", receivedAt: new Date() } });
        d = await dash();
        expect(d.shipments.arrived.count).toBe(0);
        expect(d.shipments.receiving).toMatchObject({ count: 1, bales: 3 });
        expect(d.shipments.receiving.items[0]).toMatchObject({ expectedBales: 3, receivedBales: 1 }); // progress from the manifest
        expect(d.summary.openReceivingSessions).toBe(1);
        // the open session shows the SHIPMENT's expected count (3), not the whole purchase (10)
        expect(d.openSessions[0]).toMatchObject({ reference: "RCV-DASH-LIVE", expectedBales: 3, scannedBales: 2 });
        expect(d.openSessions[0]!.shipmentReference).toContain("SHP-A2");

        await h.prisma.buyerShipment.update({ where: { id: s.mz.shipmentS2 }, data: { status: "CONFIRMED" } });
        d = await dash();
        expect(d.shipments.receiving.count).toBe(0);
        expect(d.shipments.awaitingStorage).toMatchObject({ count: 1, bales: 3 });
      } finally {
        if (sessionId) {
          await h.prisma.receivingScan.deleteMany({ where: { sessionId } });
          await h.prisma.receivingSession.delete({ where: { id: sessionId } });
        }
        await h.prisma.buyerShipmentBale.update({ where: { id: line.id }, data: { status: "EXPECTED", receivedAt: null } });
        await h.prisma.buyerShipment.update({ where: { id: s.mz.shipmentS2 }, data: { status: "IN_TRANSIT", arrivedAt: null } });
      }
      expect((await dash()).shipments.inTransit.count).toBe(1); // restored
    });

    it("a cancelled shipment is in no stage", async () => {
      await h.prisma.buyerShipment.update({ where: { id: s.mz.shipmentS2 }, data: { status: "CANCELLED" } });
      try {
        const d = await dash();
        expect([d.shipments.inTransit.count, d.shipments.arrived.count, d.shipments.receiving.count, d.shipments.awaitingStorage.count]).toEqual([0, 0, 0, 0]);
      } finally {
        await h.prisma.buyerShipment.update({ where: { id: s.mz.shipmentS2 }, data: { status: "IN_TRANSIT" } });
      }
    });
  });

  describe("filters", () => {
    it("the date range selects purchases by sale date (end day included) and leaves live status alone", async () => {
      const may = await dash({ from: "2026-05-01", to: "2026-05-31" });
      expect(may.summary).toMatchObject({ purchaseCount: 1, purchasedBales: 10, receivedBales: 6, pendingReceiptBales: 4, payableUsd: "1631.50", leviesUsd: "7.50" });
      expect(may.period).toEqual({ firstSaleDate: "2026-05-22", lastSaleDate: "2026-05-22" });
      // live position is the same whatever the range
      expect(may.summary.inventoryBales).toBe(7);
      expect(may.shipments.inTransit.count).toBe(1);
      expect(may.summary.openExceptions).toBe(1);
      // shipments COMPLETED within the range: only S1 (stored 25 May), not S3 (April)
      expect(may.shipments.completed).toEqual({ count: 1, bales: 6 });

      const oneDay = await dash({ from: "2026-05-22", to: "2026-05-22" });
      expect(oneDay.summary.purchaseCount).toBe(1);
      expect((await dash({ from: "2026-05-23", to: "2026-05-31" })).summary.purchaseCount).toBe(0);
    });

    it("an empty range returns zeros and nulls, not an error", async () => {
      const d = await dash({ from: "2027-01-01", to: "2027-12-31" });
      expect(d.summary).toMatchObject({ purchaseCount: 0, purchasedBales: 0, purchasedMassKg: "0.0", totalSpendUsd: "0.00", receivedBales: 0, pendingReceiptBales: 0, payableUsd: "0.00", leviesZig: "0.00" });
      expect(d.period).toEqual({ firstSaleDate: null, lastSaleDate: null });
      expect(d.recentPurchases).toEqual([]);
    });

    it("the floor filter applies to purchases AND to the live position", async () => {
      const other = await dash({ floor: "other" });
      expect(other.summary).toMatchObject({ purchaseCount: 1, purchasedBales: 5, receivedBales: 0, pendingReceiptBales: 5, inventoryBales: 0, openExceptions: 0 });
      expect(other.shipments.inTransit.count).toBe(0); // S2 belongs to the other floor
      const ethical = await dash({ floor: "ethical" });
      expect(ethical.summary.purchaseCount).toBe(2);
      expect(ethical.shipments.inTransit.count).toBe(1);
      const none = await dash({ floor: "zzz" });
      expect(none.summary).toMatchObject({ purchaseCount: 0, inventoryBales: 0, openReceivingSessions: 0, openExceptions: 0 });
      expect(none.shipments.completed).toEqual({ count: 0, bales: 0 });
    });

    it("rejects a bad range with a 422", async () => {
      await get(admin, { from: "2026-06-01", to: "2026-05-01" }).expect(422);
      await get(admin, { from: "tomorrow" }).expect(422);
    });
  });

  describe("access", () => {
    it("requires a buyer sign-in; staff accounts are refused", async () => {
      await h.http().get(`${API}/buyer/dashboard`).expect(401);
      const staff = bearer(await loginStaff(h));
      await get(staff).expect(403);
    });

    it("every role can read it", async () => {
      await dash({}, viewer);
    });

    it("another company sees only its own numbers", async () => {
      const d = await dash({}, kt);
      expect(d.summary).toMatchObject({ purchaseCount: 1, purchasedBales: 3, receivedBales: 0, inventoryBales: 0, openExceptions: 0, payableUsd: "0.00" });
      expect(d.shipments.inTransit).toMatchObject({ count: 1, bales: 3 });
      expect(d.shipments.inTransit.items[0]!.purchaseReference).toMatch(/^PUR-KT-/);
      expect(d.shipments.completed.count).toBe(0);
      expect(d.floorOptions).toEqual(["ETHICAL SALES FLOOR"]);
      expect(JSON.stringify(d)).not.toContain("TRK 9900"); // none of MZ's trucks leak
    });
  });
});
