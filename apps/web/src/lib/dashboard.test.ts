import { describe, expect, it } from "vitest";
import { DOCUMENTED } from "@tobacco/shared/fixtures";
import type { SaleStage, ScenarioId, StageStatus } from "@tobacco/shared";
import { buildScenario } from "@/mock/scenarios";
import { selectDashboard } from "./dashboard";

const D = DOCUMENTED;
const model = (s: ScenarioId, date: string = D.saleDate) => selectDashboard(buildScenario(s), date, "EL");
const status = (m: ReturnType<typeof model>, stage: SaleStage): StageStatus => m.stages.find((x) => x.stage === stage)!.status;

describe("sale-day model", () => {
  it("fresh morning: setup not started, nothing blocked yet, next action is Daily setup", () => {
    const m = model("FRESH");
    expect(status(m, "DAILY_SETUP")).toBe("NOT_STARTED");
    expect(status(m, "RECEIVING")).toBe("BLOCKED"); // no active sale date — receiving cannot start
    expect(m.stats.saleDateActive).toBe(false);
    expect(m.nextAction?.stage).toBeDefined();
  });

  it("after daily setup: setup complete, bookings are the next thing to do", () => {
    const m = model("START_OF_DAY");
    expect(status(m, "DAILY_SETUP")).toBe("COMPLETE");
    expect(status(m, "BOOKING_IMPORT")).toBe("ACTIVE");
    expect(m.stats.exchangeRate).toBe(D.exchangeRate);
  });

  it("received: 5 bales received vs 5 booked, 2 growers, tickets pending", () => {
    const m = model("RECEIVED");
    expect(m.stats).toMatchObject({ balesBooked: 5, balesReceived: 5, growersReceived: 2, trucksReceived: 1, ticketsPending: 5, ticketsConfirmed: 0 });
    expect(status(m, "RECEIVING")).toBe("COMPLETE");
    expect(status(m, "TICKET_PRINTING")).toBe("ACTIVE");
    expect(m.charts.perGrower.map((g) => [g.grower, g.booked, g.received]).sort()).toEqual([["V100060", 3, 3], ["V100061", 2, 2]]);
  });

  it("floor summary done with nothing captured: data capture is the active stage, 5 bales awaiting", () => {
    const m = model("FLOOR_SUMMARY_DONE");
    expect(status(m, "FLOOR_SUMMARY")).toBe("COMPLETE");
    expect(status(m, "DATA_CAPTURE")).toBe("ACTIVE");
    expect(m.stats.balesAwaitingCapture).toBe(5);
    expect(m.stats.draftSales).toBe(2);
  });

  it("balanced: stop orders become the active stage", () => {
    const m = model("BALANCED");
    expect(status(m, "BALANCING")).toBe("COMPLETE");
    expect(status(m, "STOP_ORDERS")).toBe("ACTIVE");
    expect(m.exceptions.some((e) => e.id === "balanced-wait")).toBe(true);
  });

  it("processed: stop orders complete, payment in progress, dispatch needs attention until sales are released", () => {
    const m = model("PROCESSED");
    expect(status(m, "STOP_ORDERS")).toBe("COMPLETE");
    expect(status(m, "PAYMENT")).toBe("ACTIVE");
    expect(status(m, "DISPATCH")).toBe("ATTENTION");
    expect(m.stats.payBatches).toBe(1);
    expect(m.exceptions.some((e) => e.id === "unreleased")).toBe(true);
  });

  it("released: dispatch becomes active and 5 bales are releasable", () => {
    const m = model("READY_TO_DISPATCH");
    expect(status(m, "DISPATCH")).toBe("ACTIVE");
    expect(m.stats.balesReleasable).toBe(5);
    expect(m.stats.balesDispatched).toBe(0);
  });

  it("turning floor scanning off blocks the floor summary stage with the documented message", () => {
    const db = buildScenario("TICKETS_CONFIRMED");
    db.receivingSaleDates.find((d) => d.isActive)!.canScanFloorSummary = false;
    const m = selectDashboard(db, D.saleDate, "EL");
    expect(status(m, "FLOOR_SUMMARY")).toBe("BLOCKED");
    expect(m.stages.find((s) => s.stage === "FLOOR_SUMMARY")!.blockedReason).toContain("Floor Summary scanning is currently off");
  });

  it("a day with sales but no Start of Day is flagged as an error and blocks capture/balancing", () => {
    const db = buildScenario("FLOOR_SUMMARY_DONE");
    db.startOfDays = db.startOfDays.filter((s) => s.sellingDate !== D.saleDate);
    const m = selectDashboard(db, D.saleDate, "EL");
    expect(status(m, "DATA_CAPTURE")).toBe("BLOCKED");
    expect(status(m, "BALANCING")).toBe("BLOCKED");
    expect(m.exceptions.find((e) => e.id === "no-sod")?.severity).toBe("error");
  });

  it("historical day (11 Sep) is fully processed and replays from aggregates", () => {
    const m = model("FRESH", "2026-09-11");
    expect(m.stats).toMatchObject({ bookingsCount: 8, processedSales: 3, growersReceived: 2 });
    expect(status(m, "STOP_ORDERS")).toBe("COMPLETE");
  });
});
