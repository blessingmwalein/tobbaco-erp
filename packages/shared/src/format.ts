export const ZIM_TZ = "Africa/Harare";

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export function formatTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatInt(n: number | undefined | null): string {
  return (n ?? 0).toLocaleString("en-US");
}

export function formatKg(n: number | undefined | null): string {
  return `${(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 1 })} kg`;
}

export function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** "2026-09-17" → "17 September 2026" */
export function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function yymmdd(isoDate: string): string {
  return isoDate.slice(2, 4) + isoDate.slice(5, 7) + isoDate.slice(8, 10);
}

export function yyyymmdd(isoDate: string): string {
  return isoDate.replaceAll("-", "");
}
