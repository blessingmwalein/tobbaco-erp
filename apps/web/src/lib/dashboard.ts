import {
  SALE_STAGES,
  type Bale,
  type DeliveryNote,
  type MockDb,
  type Sale,
  type SaleStage,
  type StageStatus,
} from "@tobacco/shared";

/**
 * Sale-day model: derives every stage's status, the KPIs and the outstanding exceptions from DB state.
 * Pure function — used by the dashboard and the sale-day workflow page (and, later, a backend read model).
 */

export interface StageInfo {
  stage: SaleStage;
  status: StageStatus;
  /** One-line state, e.g. "3 of 5 deliveries checked". */
  summary: string;
  blockedReason?: string;
  href: string;
  role: string;
  manual: string;
  metrics: Array<{ label: string; value: string }>;
  prerequisites: Array<{ label: string; met: boolean }>;
}

export interface ExceptionInfo {
  id: string;
  severity: "error" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
}

export interface DashboardStats {
  saleDateActive: boolean;
  canScanFloor: boolean;
  startOfDayPosted: boolean;
  exchangeRate?: string;
  bookingsCount: number;
  balesBooked: number;
  trucksReceived: number;
  growersReceived: number;
  balesReceived: number;
  ticketsPending: number;
  ticketsConfirmed: number;
  floorDeliveriesLaid: number;
  floorDeliveriesTotal: number;
  balesScanned: number;
  balesAwaitingCapture: number;
  draftSales: number;
  balancedSales: number;
  processedSales: number;
  pendingApprovals: number;
  pendingStopOrders: number;
  payBatches: number;
  paymentLinesPaid: number;
  paymentLinesTotal: number;
  balesReleasable: number;
  balesDispatched: number;
  draftDispatchNotes: number;
  postedDispatchNotes: number;
}

export interface DashboardModel {
  date: string;
  sellingPointId: string;
  stats: DashboardStats;
  stages: StageInfo[];
  exceptions: ExceptionInfo[];
  nextAction?: { stage: SaleStage; label: string; href: string };
  charts: {
    baleProgress: Array<{ name: string; value: number }>;
    perGrower: Array<{ grower: string; booked: number; received: number }>;
  };
}

const STAGE_META: Record<SaleStage, { href: string; role: string; manual: string }> = {
  DAILY_SETUP: { href: "/setup/sale-dates", role: "Receiving Supervisor · Data Processing Supervisor", manual: "Manual 01" },
  BOOKING_IMPORT: { href: "/timb/imports/new?type=GROWER_BOOKING", role: "TIMB Clerk", manual: "Manual 02" },
  RECEIVING: { href: "/floor/receiving", role: "Receiving Clerk", manual: "Manual 03" },
  TICKET_PRINTING: { href: "/floor/tickets", role: "Ticket Clerk", manual: "Manual 04" },
  FLOOR_SUMMARY: { href: "/floor/floor-summary", role: "Floor Summary Clerk", manual: "Manual 05" },
  DATA_CAPTURE: { href: "/floor/data-capture", role: "Data Clerk", manual: "Manual 06" },
  BATCH_PROCESSING: { href: "/batches", role: "Data Clerk (batch)", manual: "Manual 06" },
  BALANCING: { href: "/sales", role: "Data Processing Supervisor", manual: "Manual 06" },
  STOP_ORDERS: { href: "/finance/stop-order-processing", role: "Data Processing Supervisor", manual: "Manual 07" },
  PAYMENT: { href: "/finance/payments", role: "Accounts", manual: "Manual 08" },
  DISPATCH: { href: "/dispatch", role: "Dispatch Clerk", manual: "Manual 09" },
};

const baleIsComplete = (b: Bale): boolean => {
  if (b.saleCode) return Boolean(b.timbGrade);
  return Boolean(b.timbGrade && b.buyerCode && b.buyerGrade && b.priceCents);
};

export function selectDashboard(db: MockDb, date: string, sellingPointId: string): DashboardModel {
  const sp = sellingPointId;
  const saleDate = db.receivingSaleDates.find((d) => d.sellingPointId === sp && d.date === date);
  const sod = db.startOfDays.find((s) => s.sellingPointId === sp && s.sellingDate === date);
  const sodPosted = sod?.status === "POSTED";

  const notes: DeliveryNote[] = db.deliveryNotes.filter((d) => d.sellingPointId === sp && d.sellingDate === date);
  const noteIds = new Set(notes.map((n) => n.id));
  const bales = db.bales.filter((b) => noteIds.has(b.gdnId) && !b.ejected);
  const balesOf = (n: DeliveryNote) => (n.historicalBaleCount ?? bales.filter((b) => b.gdnId === n.id).length);

  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const trucks = db.transporterNotes.filter((t) => t.growers.some((g) => g.saleMonth === month && g.saleDay === day));
  const bookings = db.bookings.filter((b) => b.floor === sp && b.sellDate === date);
  const balesBooked = bookings.reduce((a, b) => a + b.balesBooked, 0);

  const sales: Sale[] = db.sales.filter((s) => s.sellingPointId === sp && s.saleDate === date);
  const saleIds = new Set(sales.map((s) => s.id));
  const saleBales = bales.filter((b) => b.saleId && saleIds.has(b.saleId));

  const closed = notes.filter((n) => n.state !== "OPEN");
  const printing = notes.filter((n) => n.state === "TICKETS_PRINTING");
  const confirmed = notes.filter((n) => n.state === "CHECKED" || n.state === "LAID");
  const laid = notes.filter((n) => n.state === "LAID");
  const checked = notes.filter((n) => n.state === "CHECKED");

  const draft = sales.filter((s) => s.status === "DRAFT");
  const balanced = sales.filter((s) => s.status === "BALANCED");
  const processed = sales.filter((s) => s.status === "PROCESSED");
  const awaitingCapture = saleBales.filter((b) => draft.some((s) => s.id === b.saleId) && !baleIsComplete(b));

  const batches = db.priceBatches.filter((b) => b.sellingPointId === sp && b.sellingDate === date);
  const draftBatches = batches.filter((b) => b.status === "DRAFT");

  const stopOrders = db.stopOrders.filter((s) => s.fileDate === date);
  const pendingStop = stopOrders.filter((s) => s.paidAmountCents < s.amount1Cents);

  const payBatches = db.payBatches.filter((p) => p.sellingPointId === sp && p.saleDate === date);
  const payBatchNos = new Set(payBatches.map((p) => p.no));
  const schedules = db.paymentSchedules.filter((s) => payBatchNos.has(s.payBatchNo));
  const lines = db.paymentLines.filter((l) => schedules.some((s) => s.id === l.scheduleId));
  const linesPaid = lines.filter((l) => l.status === "PAID").length;

  const releasedSales = sales.filter((s) => s.status === "PROCESSED" && s.released);
  const releasableBales = saleBales.filter((b) => releasedSales.some((s) => s.id === b.saleId) && !b.saleCode);
  const dispatched = releasableBales.filter((b) => {
    const note = b.dispatchNoteId ? db.dispatchNotes.find((d) => d.id === b.dispatchNoteId) : undefined;
    return note?.state === "POSTED";
  });
  const activeNotes = db.dispatchNotes.filter((d) => d.state !== "CANCELLED");

  const pendingApprovals = db.approvals.filter((a) => a.status === "PENDING").length;
  const saleDateActive = Boolean(saleDate?.isActive);

  const totalNotes = notes.length;
  const stats: DashboardStats = {
    saleDateActive,
    canScanFloor: Boolean(saleDate?.canScanFloorSummary),
    startOfDayPosted: Boolean(sodPosted),
    exchangeRate: sod?.exchangeRate,
    bookingsCount: bookings.length,
    balesBooked,
    trucksReceived: trucks.filter((t) => t.state === "COMPLETED").length,
    growersReceived: new Set(closed.map((n) => n.growerNo)).size,
    balesReceived: closed.reduce((a, n) => a + balesOf(n), 0),
    ticketsPending: printing.reduce((a, n) => a + balesOf(n), 0),
    ticketsConfirmed: confirmed.reduce((a, n) => a + balesOf(n), 0),
    floorDeliveriesLaid: laid.length,
    floorDeliveriesTotal: totalNotes,
    balesScanned: laid.reduce((a, n) => a + balesOf(n), 0),
    balesAwaitingCapture: awaitingCapture.length,
    draftSales: draft.length,
    balancedSales: balanced.length,
    processedSales: processed.length,
    pendingApprovals,
    pendingStopOrders: pendingStop.length,
    payBatches: payBatches.length,
    paymentLinesPaid: linesPaid,
    paymentLinesTotal: lines.length,
    balesReleasable: releasableBales.length,
    balesDispatched: dispatched.length,
    draftDispatchNotes: activeNotes.filter((d) => d.state === "DRAFT").length,
    postedDispatchNotes: activeNotes.filter((d) => d.state === "POSTED").length,
  };

  // ── Stage statuses ────────────────────────────────────────────
  const mk = (
    stage: SaleStage,
    status: StageStatus,
    summary: string,
    extra: Partial<Pick<StageInfo, "blockedReason" | "metrics" | "prerequisites">> = {},
  ): StageInfo => ({
    stage,
    status,
    summary,
    ...STAGE_META[stage],
    blockedReason: extra.blockedReason,
    metrics: extra.metrics ?? [],
    prerequisites: extra.prerequisites ?? [],
  });

  const noSaleDateReason = "No active receiving sale date — create one in Daily setup (Manual 01, Step 1).";
  const noSodReason = "Start of Day is not posted — post it with the day's exchange rate (Manual 01, Step 2).";
  const hasWork = totalNotes > 0;

  const stageDailySetup = ((): StageInfo => {
    const done = saleDateActive && sodPosted;
    return mk(
      "DAILY_SETUP",
      done ? "COMPLETE" : saleDateActive || sodPosted ? "ACTIVE" : "NOT_STARTED",
      done ? `Sale date active · Start of Day posted at ${sod?.exchangeRate}` : !saleDateActive ? "Receiving sale date not set" : "Start of Day not posted",
      {
        metrics: [
          { label: "Sale date", value: saleDateActive ? "Active" : "Not set" },
          { label: "Floor scanning", value: saleDate?.canScanFloorSummary ? "On" : "Off" },
          { label: "Exchange rate", value: sod?.exchangeRate ?? "—" },
        ],
        prerequisites: [
          { label: "Yesterday's sales are Balanced or Processed", met: !db.sales.some((s) => s.saleDate < date && (s.status === "DRAFT" || s.status === "BALANCED")) },
          { label: "Receiving sale date active", met: saleDateActive },
          { label: "Start of Day posted with an exchange rate", met: Boolean(sodPosted) },
        ],
      },
    );
  })();

  const stageBookings = mk(
    "BOOKING_IMPORT",
    bookings.length > 0 ? "COMPLETE" : "ACTIVE",
    bookings.length > 0 ? `${bookings.length} bookings · ${balesBooked} bales booked` : "No bookings imported for this day",
    {
      metrics: [
        { label: "Bookings", value: String(bookings.length) },
        { label: "Bales booked", value: String(balesBooked) },
      ],
      prerequisites: [{ label: "Growers are in the grower register", met: true }],
    },
  );

  const openTrucks = trucks.filter((t) => t.state === "OPEN").length;
  const stageReceiving = (() => {
    if (!saleDateActive && date === db.settings.demoToday && !hasWork)
      return mk("RECEIVING", "BLOCKED", "Waiting for the receiving sale date", { blockedReason: noSaleDateReason });
    const openNotes = notes.filter((n) => n.state === "OPEN").length;
    const complete = hasWork && openNotes === 0 && openTrucks === 0;
    return mk(
      "RECEIVING",
      complete ? "COMPLETE" : hasWork || openTrucks > 0 ? "ACTIVE" : "NOT_STARTED",
      hasWork
        ? `${closed.length} of ${totalNotes} grower deliveries closed · ${stats.balesReceived} bales`
        : openTrucks > 0
          ? `${openTrucks} truck note(s) open`
          : "No trucks received yet",
      {
        metrics: [
          { label: "Trucks", value: String(stats.trucksReceived) },
          { label: "Growers", value: String(stats.growersReceived) },
          { label: "Bales", value: String(stats.balesReceived) },
        ],
        prerequisites: [
          { label: "Receiving sale date active", met: saleDateActive },
          { label: "Bookings imported", met: bookings.length > 0 },
        ],
      },
    );
  })();

  const stageTickets = (() => {
    const complete = hasWork && printing.length === 0 && notes.every((n) => n.state !== "OPEN");
    const blocked = printing.length > 0 && !saleDateActive;
    return mk(
      "TICKET_PRINTING",
      blocked ? "BLOCKED" : complete ? "COMPLETE" : printing.length > 0 ? "ACTIVE" : "NOT_STARTED",
      hasWork ? `${confirmed.length} of ${totalNotes} deliveries confirmed · ${stats.ticketsPending} tickets pending` : "Waiting for completed deliveries",
      {
        blockedReason: blocked ? "Date has expired. Please set a valid sale date" : undefined,
        metrics: [
          { label: "Pending", value: String(stats.ticketsPending) },
          { label: "Confirmed", value: String(stats.ticketsConfirmed) },
        ],
        prerequisites: [
          { label: "Receiving sale date active", met: saleDateActive },
          { label: "Deliveries completed at receiving", met: closed.length > 0 },
        ],
      },
    );
  })();

  const stageFloor = (() => {
    const scanningOff = checked.length > 0 && !stats.canScanFloor;
    const complete = hasWork && laid.length === totalNotes;
    return mk(
      "FLOOR_SUMMARY",
      scanningOff ? "BLOCKED" : complete ? "COMPLETE" : checked.length > 0 || laid.length > 0 ? "ACTIVE" : "NOT_STARTED",
      hasWork ? `${laid.length} of ${totalNotes} deliveries laid · ${stats.balesScanned} bales scanned` : "Waiting for checked deliveries",
      {
        blockedReason: scanningOff ? "Floor Summary scanning is currently off. Ask the receiving manager to turn it on." : undefined,
        metrics: [
          { label: "Laid", value: `${laid.length}/${totalNotes}` },
          { label: "Scanned bales", value: String(stats.balesScanned) },
        ],
        prerequisites: [
          { label: "Deliveries Checked (tickets confirmed)", met: confirmed.length > 0 },
          { label: "Can Scan Floor Summary? is on", met: stats.canScanFloor },
        ],
      },
    );
  })();

  const stageCapture = (() => {
    const blocked = draft.length > 0 && !sodPosted;
    const complete = sales.length > 0 && draft.length === 0 ? true : sales.length > 0 && awaitingCapture.length === 0;
    return mk(
      "DATA_CAPTURE",
      blocked ? "BLOCKED" : complete ? "COMPLETE" : sales.length > 0 ? "ACTIVE" : "NOT_STARTED",
      sales.length > 0 ? `${awaitingCapture.length} bales still need grade, buyer or price` : "No draft sales yet",
      {
        blockedReason: blocked ? "Start of Day must be posted before data capture (Manual 01, Step 2)." : undefined,
        metrics: [
          { label: "Awaiting capture", value: String(awaitingCapture.length) },
          { label: "Draft sales", value: String(draft.length) },
        ],
        prerequisites: [
          { label: "Start of Day posted", met: Boolean(sodPosted) },
          { label: "Floor summary complete (sale exists in Draft)", met: sales.length > 0 },
        ],
      },
    );
  })();

  const stageBatch = mk(
    "BATCH_PROCESSING",
    batches.length === 0 ? "NOT_STARTED" : draftBatches.length === 0 ? "COMPLETE" : "ACTIVE",
    batches.length === 0 ? "No price batches yet" : `${batches.length - draftBatches.length} of ${batches.length} batches posted`,
    {
      metrics: [
        { label: "Posted", value: `${batches.length - draftBatches.length}/${batches.length}` },
      ],
      prerequisites: [{ label: "Sale exists in Draft", met: sales.length > 0 }],
    },
  );

  const stageBalance = (() => {
    const blocked = draft.length > 0 && !sodPosted;
    const complete = sales.length > 0 && draft.length === 0;
    return mk(
      "BALANCING",
      blocked ? "BLOCKED" : complete ? "COMPLETE" : draft.length > 0 && draftBatches.length < batches.length ? "ACTIVE" : draft.length > 0 ? "ATTENTION" : "NOT_STARTED",
      sales.length === 0 ? "No sales to balance" : `${balanced.length + processed.length} of ${sales.length} sales balanced`,
      {
        blockedReason: blocked ? "Start of Day must be posted before balancing." : undefined,
        metrics: [
          { label: "Draft", value: String(draft.length) },
          { label: "Balanced", value: String(balanced.length) },
          { label: "Processed", value: String(processed.length) },
        ],
        prerequisites: [
          { label: "Every bale has grade, buyer, buyer grade and price", met: sales.length > 0 && awaitingCapture.length === 0 },
          { label: "Price batches posted and prices match", met: batches.length > 0 && draftBatches.length === 0 },
        ],
      },
    );
  })();

  const stageStop = (() => {
    const blocked = balanced.length > 0 && !sodPosted;
    const attention = pendingApprovals > 0 && balanced.length > 0;
    const complete = sales.length > 0 && processed.length === sales.length;
    return mk(
      "STOP_ORDERS",
      blocked ? "BLOCKED" : complete ? "COMPLETE" : attention ? "ATTENTION" : balanced.length > 0 ? "ACTIVE" : "NOT_STARTED",
      sales.length === 0 ? "Waiting for balanced sales" : `${processed.length} of ${sales.length} sales processed`,
      {
        blockedReason: blocked ? "Exchange rate is not set for this sale. Post Start of Day for the sale date." : undefined,
        metrics: [
          { label: "Balanced, to process", value: String(balanced.length) },
          { label: "Pending stop orders", value: String(pendingStop.length) },
          { label: "Pending approvals", value: String(pendingApprovals) },
        ],
        prerequisites: [
          { label: "Sales Balanced", met: balanced.length + processed.length > 0 },
          { label: "Stop order file imported", met: stopOrders.length > 0 },
          { label: "No pending approvals", met: pendingApprovals === 0 },
        ],
      },
    );
  })();

  const stagePayment = (() => {
    const complete = lines.length > 0 && linesPaid === lines.length;
    return mk(
      "PAYMENT",
      complete ? "COMPLETE" : processed.length > 0 ? "ACTIVE" : "NOT_STARTED",
      processed.length === 0 ? "Waiting for processed sales" : lines.length === 0 ? `Pay batch ${payBatches.map((p) => p.no).join(", ")} — no schedule generated` : `${linesPaid} of ${lines.length} payments confirmed`,
      {
        metrics: [
          { label: "Pay batches", value: String(payBatches.length) },
          { label: "Confirmed", value: `${linesPaid}/${lines.length}` },
        ],
        prerequisites: [
          { label: "Sales Processed (pay batch number)", met: processed.length > 0 },
          { label: "Growers have bank details", met: true },
        ],
      },
    );
  })();

  const stageDispatch = (() => {
    const complete = releasableBales.length > 0 && dispatched.length === releasableBales.length;
    const waitingRelease = processed.length > 0 && releasedSales.length === 0;
    return mk(
      "DISPATCH",
      complete ? "COMPLETE" : releasedSales.length > 0 || stats.draftDispatchNotes > 0 ? "ACTIVE" : waitingRelease ? "ATTENTION" : "NOT_STARTED",
      waitingRelease ? "Sales are not released — dispatch refuses unreleased bales" : releasableBales.length === 0 ? "Waiting for released sales" : `${dispatched.length} of ${releasableBales.length} bales dispatched`,
      {
        metrics: [
          { label: "Dispatched", value: `${dispatched.length}/${releasableBales.length}` },
          { label: "Draft notes", value: String(stats.draftDispatchNotes) },
          { label: "Posted notes", value: String(stats.postedDispatchNotes) },
        ],
        prerequisites: [
          { label: "Sale released", met: releasedSales.length > 0 },
          { label: "Destination warehouse set up", met: db.warehouses.some((w) => w.active) },
        ],
      },
    );
  })();

  const stageMap: Record<SaleStage, StageInfo> = {
    DAILY_SETUP: stageDailySetup,
    BOOKING_IMPORT: stageBookings,
    RECEIVING: stageReceiving,
    TICKET_PRINTING: stageTickets,
    FLOOR_SUMMARY: stageFloor,
    DATA_CAPTURE: stageCapture,
    BATCH_PROCESSING: stageBatch,
    BALANCING: stageBalance,
    STOP_ORDERS: stageStop,
    PAYMENT: stagePayment,
    DISPATCH: stageDispatch,
  };
  const stages = SALE_STAGES.map((s) => stageMap[s]);

  // ── Exceptions ────────────────────────────────────────────────
  const exceptions: ExceptionInfo[] = [];
  const started = hasWork || sales.length > 0;
  if (date === db.settings.demoToday && !saleDateActive && started)
    exceptions.push({ id: "no-sale-date", severity: "error", title: "No active receiving sale date", detail: noSaleDateReason, href: "/setup/sale-dates" });
  if (!sodPosted && sales.length > 0)
    exceptions.push({ id: "no-sod", severity: "error", title: "Start of Day not posted", detail: noSodReason, href: "/setup/start-of-day" });
  if (checked.length > 0 && !stats.canScanFloor)
    exceptions.push({ id: "scan-off", severity: "warning", title: "Floor summary scanning is off", detail: "Ask the receiving manager to turn it on.", href: "/floor/floor-summary" });
  if (pendingApprovals > 0)
    exceptions.push({ id: "approvals", severity: "warning", title: `${pendingApprovals} pending approval(s)`, detail: "Stop order processing is blocked until they are decided.", href: "/approvals" });
  for (const n of notes.filter((x) => x.state === "OPEN" && bales.some((b) => b.gdnId === x.id))) {
    const got = bales.filter((b) => b.gdnId === n.id).length;
    if (got !== n.balesDeclared)
      exceptions.push({ id: `tally-${n.id}`, severity: "info", title: `${n.docNo}: ${got} of ${n.balesDeclared} bales captured`, detail: "Delivery cannot be completed until the tally matches the declared bales.", href: `/receiving/delivery-notes/${n.id}` });
  }
  for (const n of notes) {
    const booked = bookings.filter((b) => b.growerNo === n.growerNo).reduce((a, b) => a + b.balesBooked, 0);
    if (!n.historicalBaleCount && booked > 0 && n.balesDeclared > booked)
      exceptions.push({ id: `unbooked-${n.id}`, severity: "warning", title: `${n.growerNo}: ${n.balesDeclared - booked} unbooked bale(s)`, detail: `${n.balesDeclared} declared vs ${booked} booked. (Whether this blocks is unverified — UQ-09.)`, href: `/receiving/delivery-notes/${n.id}` });
  }
  if (draft.length > 0 && awaitingCapture.length > 0)
    exceptions.push({ id: "capture", severity: "info", title: `${awaitingCapture.length} bale(s) awaiting data capture`, detail: "Grade, buyer, buyer grade or price missing.", href: "/floor/data-capture" });
  if (balanced.length > 0)
    exceptions.push({ id: "balanced-wait", severity: "info", title: `${balanced.length} balanced sale(s) awaiting stop order processing`, detail: "Run Stop Order Processing to take deductions and assign a pay batch number.", href: "/finance/stop-order-processing" });
  const unreleased = processed.filter((s) => !s.released);
  if (unreleased.length > 0)
    exceptions.push({ id: "unreleased", severity: "info", title: `${unreleased.length} processed sale(s) not released`, detail: "Dispatch refuses bales from sales that have not been released.", href: "/sales" });
  const noBank = processed
    .map((s) => s.growerNo)
    .filter((g) => !db.growerBankAccounts.some((a) => a.growerNo === g));
  if (noBank.length > 0)
    exceptions.push({ id: "bank", severity: "warning", title: `${noBank.length} grower(s) without bank details`, detail: `${noBank.join(", ")} would be left out of the payment schedule.`, href: "/growers" });

  // ── Charts ────────────────────────────────────────────────────
  const baleProgress = [
    { name: "Booked", value: balesBooked },
    { name: "Received", value: stats.balesReceived },
    { name: "Tickets confirmed", value: stats.ticketsConfirmed },
    { name: "Scanned on floor", value: stats.balesScanned },
    { name: "Captured", value: Math.max(0, saleBales.length - awaitingCapture.length) },
    { name: "Dispatched", value: stats.balesDispatched },
  ];
  const growers = new Set<string>([...bookings.map((b) => b.growerNo), ...notes.map((n) => n.growerNo)]);
  const perGrower = [...growers].map((g) => ({
    grower: g,
    booked: bookings.filter((b) => b.growerNo === g).reduce((a, b) => a + b.balesBooked, 0),
    received: notes.filter((n) => n.growerNo === g && n.state !== "OPEN").reduce((a, n) => a + balesOf(n), 0),
  }));

  const next = stages.find((s) => s.status !== "COMPLETE" && s.status !== "NOT_STARTED") ?? stages.find((s) => s.status === "NOT_STARTED");
  return {
    date,
    sellingPointId: sp,
    stats,
    stages,
    exceptions,
    nextAction: next
      ? { stage: next.stage, label: next.status === "BLOCKED" ? `Unblock: ${next.summary}` : next.summary, href: next.href }
      : undefined,
    charts: { baleProgress, perGrower },
  };
}
