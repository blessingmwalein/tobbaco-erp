import type { Bale } from "@tobacco/shared";
import { cn } from "@tobacco/ui";

/** "2026-09-17" → "09/17/2026" (the format printed on the manual's sample ticket). */
export function ticketDate(iso: string): string {
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
}

/** Decorative bars derived from the digits. NOT a scannable symbology — preview only. */
function PreviewBars({ value }: { value: string }) {
  const bars: Array<{ x: number; w: number }> = [];
  let x = 0;
  for (const ch of value) {
    const d = Number(ch) || 0;
    for (const w of [1 + (d % 3), 1 + ((d + 1) % 2), 1 + ((d + 2) % 3)]) {
      bars.push({ x, w });
      x += w + 1;
    }
    x += 1;
  }
  return (
    <svg viewBox={`0 0 ${x} 20`} preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={20} fill="currentColor" />
      ))}
    </svg>
  );
}

/**
 * One bale ticket, laid out like the manual's sample (sale date, scale barcode - ticket barcode, grower, group, mass,
 * sale room). The meaning of the leading and trailing "1" on the sample is not documented (UQ-27): shown as floor sale and lot.
 */
export function BaleTicket({
  bale,
  growerNo,
  saleDate,
  floorSale,
  saleRoom,
  className,
}: {
  bale: Pick<Bale, "scaleBarcode" | "ticketBarcode" | "group" | "lot" | "mass">;
  growerNo: string;
  saleDate: string;
  floorSale: number;
  saleRoom: string;
  className?: string;
}) {
  return (
    <article
      className={cn("break-inside-avoid rounded-lg border border-neutral-dark/70 bg-white p-3 font-mono text-[12px] leading-5 text-black", className)}
      data-testid="bale-ticket"
      data-ticket={bale.ticketBarcode}
    >
      <p>
        {floorSale} · {ticketDate(saleDate)}
      </p>
      {bale.ticketBarcode ? <PreviewBars value={bale.ticketBarcode} /> : <div className="h-8 rounded bg-surface-tertiary" aria-hidden />}
      <p className="font-semibold">
        {bale.scaleBarcode} - {bale.ticketBarcode ?? "no barcode yet"} · {bale.lot}
      </p>
      <p>
        {growerNo} · {bale.group} · {bale.mass}
      </p>
      <p>{saleRoom}</p>
    </article>
  );
}

export function TicketSheet({
  bales,
  growerNo,
  saleDate,
  floorSale,
  saleRoom,
}: {
  bales: Array<Pick<Bale, "id" | "scaleBarcode" | "ticketBarcode" | "group" | "lot" | "mass">>;
  growerNo: string;
  saleDate: string;
  floorSale: number;
  saleRoom: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 print:grid-cols-3" data-testid="ticket-sheet">
      {bales.map((b) => (
        <BaleTicket key={b.id} bale={b} growerNo={growerNo} saleDate={saleDate} floorSale={floorSale} saleRoom={saleRoom} />
      ))}
    </div>
  );
}
