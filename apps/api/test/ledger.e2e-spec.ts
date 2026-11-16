import type { BuyerPrincipal } from "../src/common/principal";
import { PrismaService } from "../src/database/prisma.service";
import { LedgerService, makeLedgerCtx, type RefInput } from "../src/modules/ledger/ledger.service";
import { boot, describeDb, type Harness } from "./helpers";
import { makeBale, makePurchase } from "./fixtures";

describeDb("inventory ledger (receive → store → move → dispatch → return)", () => {
  let h: Harness;
  let prisma: PrismaService;
  let ledger: LedgerService;
  let mz: string;
  let principal: BuyerPrincipal;
  let purchaseId: string;
  let main: { warehouseId: string; bayId: string; rowId: string };
  let main2: { warehouseId: string; bayId: string; rowId: string };
  let secondary: { warehouseId: string; bayId: string; rowId: string };
  let processing: { warehouseId: string; bayId: string; rowId: string };
  const session: RefInput = { type: "RECEIVING_SESSION", id: "00000000-0000-4000-8000-000000000001", label: "RCV-MZ-TEST" };
  const dispatch: RefInput = { type: "DISPATCH", id: "00000000-0000-4000-8000-000000000002", label: "DSP-MZ-TEST" };
  const ret: RefInput = { type: "RETURN", id: "00000000-0000-4000-8000-000000000003", label: "RET-MZ-TEST" };

  const run = <T>(fn: (ctx: ReturnType<typeof makeLedgerCtx>) => Promise<T>) =>
    prisma.tenantTransaction(mz, (tx) => fn(makeLedgerCtx(tx, principal)));

  async function loc(warehouseCode: string, bayCode = "BAY-01", rowCode = "ROW-A") {
    const w = await h.prisma.warehouse.findFirstOrThrow({ where: { buyerOrganisationId: mz, code: warehouseCode } });
    const bay = await h.prisma.bay.findFirstOrThrow({ where: { warehouseId: w.id, code: bayCode } });
    const row = await h.prisma.warehouseRow.findFirstOrThrow({ where: { bayId: bay.id, code: rowCode } });
    return { warehouseId: w.id, bayId: bay.id, rowId: row.id };
  }

  /** A fresh EXPECTED bale with its PURCHASED event (so the projection can be derived from events). */
  async function expectedBale(barcode: string) {
    const bale = await makeBale(h.prisma, mz, purchaseId, barcode);
    await run((ctx) => ledger.appendEvent(ctx, bale.id, { type: "PURCHASED", notes: "test" }));
    return bale;
  }

  beforeAll(async () => {
    h = await boot();
    mz = h.seed.mzId;
    prisma = h.app.get(PrismaService);
    ledger = h.app.get(LedgerService);
    const user = await h.prisma.buyerUser.findFirstOrThrow({ where: { buyerOrganisationId: mz } });
    principal = {
      type: "BUYER",
      id: user.id,
      name: user.name,
      email: user.email,
      organisationId: mz,
      organisationCode: "MZ",
      organisationName: "MOROZ TOBACCO",
      roles: ["BUYER_ADMINISTRATOR"],
      permissions: new Set(),
    };
    purchaseId = (await makePurchase(h.prisma, mz)).id;
    main = await loc("MAIN", "BAY-01", "ROW-A");
    main2 = await loc("MAIN", "BAY-02", "ROW-B");
    secondary = await loc("SEC", "BAY-01", "ROW-A");
    processing = await loc("PROC", "BAY-01", "ROW-A");
  });
  afterAll(async () => {
    await h?.close();
  });

  const resolve = (l: { warehouseId: string; bayId: string; rowId: string }, kind?: "STANDARD" | "PROCESSING") =>
    prisma.tenantTransaction(mz, (tx) => ledger.resolveLocation(tx, l, { kind }));

  it("receives an expected bale, stores it and keeps projection == events", async () => {
    const bale = await expectedBale("111000010A");
    const where = await resolve(main, "STANDARD");
    await run((ctx) => ledger.receive(ctx, bale, { session, location: where }));
    const back = await h.prisma.bale.findUniqueOrThrow({ where: { id: bale.id } });
    expect(back.status).toBe("IN_STOCK");
    expect(back.currentWarehouseId).toBe(main.warehouseId);
    expect(back.currentRowId).toBe(main.rowId);
    const events = await h.prisma.baleEvent.findMany({ where: { baleId: bale.id }, orderBy: { occurredAt: "asc" } });
    expect(events.map((e) => e.type)).toEqual(["PURCHASED", "RECEIVED", "STORED"]);
    expect(await ledger.reconcileProjection(mz)).toEqual([]);
  });

  it("refuses to receive the same bale twice", async () => {
    const bale = await expectedBale("111000021B");
    await run((ctx) => ledger.receive(ctx, bale, { session }));
    await expect(run((ctx) => ledger.receive(ctx, bale, { session }))).rejects.toMatchObject({ code: "BALE_ALREADY_RECEIVED" });
  });

  it("classifies placement as STORE → MOVE → TRANSFER and records from/to", async () => {
    const bale = await expectedBale("111000032C");
    await run((ctx) => ledger.receive(ctx, bale, { session })); // received but not yet stored
    const stored = await run(async (ctx) => ledger.place(ctx, bale.id, await ledger.resolveLocation(ctx.tx, main, { kind: "STANDARD" }), { reason: "Initial put-away" }));
    expect(stored.type).toBe("STORE");
    const moved = await run(async (ctx) => ledger.place(ctx, bale.id, await ledger.resolveLocation(ctx.tx, main2, { kind: "STANDARD" }), { reason: "Consolidation" }));
    expect(moved.type).toBe("MOVE");
    const transferred = await run(async (ctx) => ledger.place(ctx, bale.id, await ledger.resolveLocation(ctx.tx, secondary, { kind: "STANDARD" }), { reason: "Transfer to secondary" }));
    expect(transferred.type).toBe("TRANSFER");
    expect(transferred.from).toContain("Buyer Main Warehouse");
    expect(transferred.to).toContain("Buyer Secondary Warehouse");
    const movements = await h.prisma.baleMovement.findMany({ where: { baleId: bale.id }, orderBy: { performedAt: "asc" } });
    expect(movements.map((m) => m.type)).toEqual(["STORE", "MOVE", "TRANSFER"]);
    expect(await ledger.reconcileProjection(mz)).toEqual([]);
  });

  it("will not move a bale to its current location or into the wrong kind of warehouse", async () => {
    const bale = await expectedBale("111000043D");
    await run(async (ctx) => ledger.receive(ctx, bale, { session, location: await ledger.resolveLocation(ctx.tx, main, { kind: "STANDARD" }) }));
    await expect(run(async (ctx) => ledger.place(ctx, bale.id, await ledger.resolveLocation(ctx.tx, main), { reason: "same" }))).rejects.toMatchObject({ code: "SAME_LOCATION" });
    await expect(run(async (ctx) => ledger.place(ctx, bale.id, await ledger.resolveLocation(ctx.tx, processing), { reason: "wrong kind" }))).rejects.toMatchObject({ code: "WRONG_WAREHOUSE_KIND" });
  });

  it("validates that a row belongs to its bay and warehouse", async () => {
    await expect(resolve({ warehouseId: main.warehouseId, bayId: secondary.bayId, rowId: secondary.rowId })).rejects.toMatchObject({ code: "INVALID_LOCATION" });
    await expect(resolve({ warehouseId: main.warehouseId, bayId: main.bayId, rowId: secondary.rowId })).rejects.toMatchObject({ code: "INVALID_LOCATION" });
  });

  it("dispatches: leaves available stock, records the exact source location, keeps full history", async () => {
    const bale = await expectedBale("111000054E");
    await run(async (ctx) => ledger.receive(ctx, bale, { session, location: await ledger.resolveLocation(ctx.tx, main, { kind: "STANDARD" }) }));
    const source = await run((ctx) => ledger.dispatchOut(ctx, bale, { dispatch, companyName: "Demo Processor" }));
    expect(source.warehouseId).toBe(main.warehouseId);
    expect(source.rowId).toBe(main.rowId);
    expect(source.label).toBe("Buyer Main Warehouse › BAY-01 › ROW-A");
    const back = await h.prisma.bale.findUniqueOrThrow({ where: { id: bale.id } });
    expect(back.status).toBe("DISPATCHED");
    expect(back.currentWarehouseId).toBeNull();
    // available stock query no longer sees it, but its history is intact
    expect(await h.prisma.bale.count({ where: { id: bale.id, status: "IN_STOCK" } })).toBe(0);
    expect(await h.prisma.baleEvent.count({ where: { baleId: bale.id } })).toBe(4); // purchased, received, stored, dispatched
    await expect(run((ctx) => ledger.dispatchOut(ctx, bale, { dispatch, companyName: "Demo Processor" }))).rejects.toMatchObject({ code: "BALE_NOT_AVAILABLE" });
    expect(await ledger.reconcileProjection(mz)).toEqual([]);
  });

  it("a bale that is only EXPECTED (never received) cannot be dispatched", async () => {
    const bale = await expectedBale("111000065F");
    await expect(run((ctx) => ledger.dispatchOut(ctx, bale, { dispatch, companyName: "Demo Processor" }))).rejects.toMatchObject({ code: "BALE_NOT_AVAILABLE" });
  });

  it("concurrent dispatch of one bale: exactly one succeeds (no double dispatch)", async () => {
    const bale = await expectedBale("111000076G");
    await run(async (ctx) => ledger.receive(ctx, bale, { session, location: await ledger.resolveLocation(ctx.tx, main, { kind: "STANDARD" }) }));
    const attempts = await Promise.allSettled([
      run((ctx) => ledger.dispatchOut(ctx, bale, { dispatch, companyName: "A" })),
      run((ctx) => ledger.dispatchOut(ctx, bale, { dispatch, companyName: "B" })),
      run((ctx) => ledger.dispatchOut(ctx, bale, { dispatch, companyName: "C" })),
    ]);
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    expect(await h.prisma.baleMovement.count({ where: { baleId: bale.id, type: "DISPATCH_OUT" } })).toBe(1);
    expect(await ledger.reconcileProjection(mz)).toEqual([]);
  });

  it("a failing step rolls the whole transaction back (no half-dispatched bale, no orphan events)", async () => {
    const bale = await expectedBale("111000087H");
    await run(async (ctx) => ledger.receive(ctx, bale, { session, location: await ledger.resolveLocation(ctx.tx, main, { kind: "STANDARD" }) }));
    const eventsBefore = await h.prisma.baleEvent.count({ where: { baleId: bale.id } });
    await expect(
      run(async (ctx) => {
        await ledger.dispatchOut(ctx, bale, { dispatch, companyName: "Demo Processor" });
        throw new Error("boom — later step failed");
      }),
    ).rejects.toThrow(/boom/);
    const back = await h.prisma.bale.findUniqueOrThrow({ where: { id: bale.id } });
    expect(back.status).toBe("IN_STOCK");
    expect(back.currentRowId).toBe(main.rowId);
    expect(await h.prisma.baleEvent.count({ where: { baleId: bale.id } })).toBe(eventsBefore);
  });

  it("returns a dispatched bale into a PROCESSING warehouse only", async () => {
    const bale = await expectedBale("111000098I");
    await run(async (ctx) => ledger.receive(ctx, bale, { session, location: await ledger.resolveLocation(ctx.tx, main, { kind: "STANDARD" }) }));
    await run((ctx) => ledger.dispatchOut(ctx, bale, { dispatch, companyName: "Demo Processor" }));
    await expect(run(async (ctx) => ledger.returnIn(ctx, bale, { ret, location: await ledger.resolveLocation(ctx.tx, main) }))).rejects.toMatchObject({ code: "WRONG_WAREHOUSE_KIND" });
    await run(async (ctx) => ledger.returnIn(ctx, bale, { ret, location: await ledger.resolveLocation(ctx.tx, processing, { kind: "PROCESSING" }), massKg: "110" }));
    const back = await h.prisma.bale.findUniqueOrThrow({ where: { id: bale.id } });
    expect(back.status).toBe("RETURNED");
    expect(back.currentWarehouseId).toBe(processing.warehouseId);
    expect(String(back.massKg)).toBe("110");
    await expect(run(async (ctx) => ledger.returnIn(ctx, bale, { ret, location: await ledger.resolveLocation(ctx.tx, processing) }))).rejects.toMatchObject({ code: "BALE_NOT_DISPATCHED" });
    expect(await ledger.reconcileProjection(mz)).toEqual([]);
  });

  it("re-identification supersedes the original bale, creates the new bale and links both with lineage", async () => {
    const original = await expectedBale("111000109J");
    await run(async (ctx) => ledger.receive(ctx, original, { session, location: await ledger.resolveLocation(ctx.tx, main, { kind: "STANDARD" }) }));
    await run((ctx) => ledger.dispatchOut(ctx, original, { dispatch, companyName: "Demo Processor" }));
    const fresh = await h.prisma.bale.findUniqueOrThrow({ where: { id: original.id } });
    const created = await run(async (ctx) =>
      ledger.reidentify(ctx, fresh, { newBarcode: "999000011K", newMassKg: "104.5", newBuyerGrade: "L4R", ret, reason: "Reprocessed and re-baled", location: await ledger.resolveLocation(ctx.tx, processing, { kind: "PROCESSING" }) }),
    );
    expect(created.barcode).toBe("999000011K");
    expect(created.status).toBe("RETURNED");
    expect(created.isProcessed).toBe(true);
    expect((await h.prisma.bale.findUniqueOrThrow({ where: { id: original.id } })).status).toBe("SUPERSEDED");
    const lineage = await h.prisma.baleLineage.findFirstOrThrow({ where: { originalBaleId: original.id } });
    expect(lineage.newBaleId).toBe(created.id);
    expect(lineage.newBarcode).toBe("999000011K");
    // both timelines keep their own history
    expect(await h.prisma.baleEvent.count({ where: { baleId: original.id, type: "RE_IDENTIFIED" } })).toBe(1);
    expect(await h.prisma.baleEvent.count({ where: { baleId: created.id, type: "RE_IDENTIFIED" } })).toBe(1);
    expect(await ledger.reconcileProjection(mz)).toEqual([]);
  });

  it("reconcileProjection detects a tampered projection", async () => {
    const bale = await expectedBale("111000110K");
    await run((ctx) => ledger.receive(ctx, bale, { session }));
    await h.prisma.bale.update({ where: { id: bale.id }, data: { status: "EXPECTED" } }); // tamper: projection no longer matches events
    const problems = await ledger.reconcileProjection(mz);
    expect(problems).toEqual(expect.arrayContaining([expect.objectContaining({ baleId: bale.id, field: "status", projection: "EXPECTED", derived: "IN_STOCK" })]));
    await h.prisma.bale.update({ where: { id: bale.id }, data: { status: "IN_STOCK" } });
  });

  it("a scoped transaction cannot touch another organisation's bale", async () => {
    const kt = h.seed.ktId;
    const other = await makePurchase(h.prisma, kt, "KT");
    const foreign = await makeBale(h.prisma, kt, other.id, "222000121L");
    await expect(run((ctx) => ledger.receive(ctx, foreign, { session }))).rejects.toMatchObject({ code: "BALE_ALREADY_RECEIVED" }); // filtered out → count 0, nothing leaked
    expect((await h.prisma.bale.findUniqueOrThrow({ where: { id: foreign.id } })).status).toBe("EXPECTED");
  });
});
