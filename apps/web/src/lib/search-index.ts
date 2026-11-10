import type { MockDb, Permission } from "@tobacco/shared";
import { NAV_GROUPS } from "./nav";

export type SearchKind = "Page" | "Grower" | "Booking" | "Transporter note" | "Delivery note" | "Bale" | "Sale" | "Price batch" | "Dispatch" | "Pay batch" | "Import";

export interface SearchItem {
  id: string;
  kind: SearchKind;
  label: string;
  sub?: string;
  href: string;
  /** Lower-case haystack. */
  hay: string;
}

const item = (kind: SearchKind, id: string, label: string, sub: string | undefined, href: string, extra = ""): SearchItem => ({
  id: `${kind}:${id}`,
  kind,
  label,
  sub,
  href,
  hay: `${label} ${sub ?? ""} ${extra}`.toLowerCase(),
});

/**
 * Global search index. Business references stay searchable everywhere (brief Part 8): grower number, TIMB booking
 * reference, TDN, GDN, scale/ticket barcodes, sale reference, batch number, dispatch reference, pay batch.
 */
export function buildSearchIndex(db: MockDb, can: (p: Permission) => boolean): SearchItem[] {
  const out: SearchItem[] = [];
  for (const g of NAV_GROUPS)
    for (const i of g.items)
      if (!i.permission || can(i.permission)) out.push(item("Page", i.href, i.label, g.label, i.href, i.keywords));

  if (can("growers.view")) {
    for (const g of db.growers)
      out.push(item("Grower", g.growerNo, `${g.growerNo} · ${g.firstName} ${g.surname}`, `District ${g.district}`, `/growers/${g.growerNo}`));
  }
  if (can("timb.view")) {
    for (const b of db.bookings)
      out.push(item("Booking", b.bookedId, b.bookedId, `${b.growerNo} · ${b.balesBooked} bales · ${b.sellDate}`, `/timb/bookings?q=${b.bookedId}`, b.growerNo));
    for (const j of db.importJobs) out.push(item("Import", j.id, `${j.ref} · ${j.filename}`, j.status.replaceAll("_", " ").toLowerCase(), `/timb/imports/${j.id}`));
  }
  if (can("receiving.view")) {
    for (const t of db.transporterNotes)
      out.push(item("Transporter note", t.id, t.docNo, `${t.transporterName} · ${t.vehicleReg}`, `/receiving/transporter-notes/${t.id}`));
    for (const d of db.deliveryNotes)
      out.push(item("Delivery note", d.id, d.docNo, `${d.growerNo} · ${d.balesDeclared} bales`, `/receiving/delivery-notes/${d.id}`));
    for (const b of db.bales) {
      const note = db.deliveryNotes.find((d) => d.id === b.gdnId);
      out.push(
        item("Bale", b.id, b.ticketBarcode ?? b.scaleBarcode, `${b.growerNo} · scale ${b.scaleBarcode}${b.ticketBarcode ? ` · ticket ${b.ticketBarcode}` : ""}`, `/receiving/delivery-notes/${b.gdnId}`, `${b.scaleBarcode} ${b.ticketBarcode ?? ""} ${note?.docNo ?? ""}`),
      );
    }
  }
  if (can("sales.view")) {
    for (const s of db.sales)
      out.push(item("Sale", s.id, `Sale #${s.refNo} · ${s.growerNo}`, `${s.status.toLowerCase()} · ${s.saleDate}`, `/sales/${s.id}`, `salesmaster ${s.refNo}`));
  }
  if (can("batch.view")) {
    for (const b of db.priceBatches)
      out.push(item("Price batch", b.id, `Batch ${b.refNo} · ${b.growerNo}`, b.status.toLowerCase(), `/batches/${b.id}`));
  }
  if (can("dispatch.view")) {
    for (const d of db.dispatchNotes) out.push(item("Dispatch", d.id, d.ref, `${d.state.toLowerCase()} · ${d.totalBales} bales`, `/dispatch/${d.id}`));
  }
  if (can("payments.view")) {
    for (const p of db.payBatches) out.push(item("Pay batch", String(p.no), `Pay batch ${p.no}`, p.saleDate, `/finance/payments/${p.no}`));
  }
  return out;
}

export function searchItems(index: SearchItem[], query: string, perKind = 6): SearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return index.filter((i) => i.kind === "Page").slice(0, 8);
  const scored = index
    .map((i) => {
      const label = i.label.toLowerCase();
      const score = label === q ? 4 : label.startsWith(q) ? 3 : label.includes(q) ? 2 : i.hay.includes(q) ? 1 : 0;
      return { i, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const counts = new Map<SearchKind, number>();
  const out: SearchItem[] = [];
  for (const { i } of scored) {
    const c = counts.get(i.kind) ?? 0;
    if (c >= perKind) continue;
    counts.set(i.kind, c + 1);
    out.push(i);
  }
  return out;
}
