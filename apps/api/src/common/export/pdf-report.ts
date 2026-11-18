import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { humanizeStatus, statusTone, type ReportColumnDto, type ReportTone } from "@tobacco/shared";
import { DEFAULT_WEIGHT, defaultAlign, formatCell, formatDocDateTime } from "./format";
import type { ExportDocument, ExportSection } from "./types";

// ── Layout (A4 landscape, points) ────────────────────────────────────────────
const W = 841.89;
const H = 595.28;
const MARGIN = 36;
const FOOTER_H = 26;
const BODY_W = W - MARGIN * 2;
const ROW_H = 15;
const HEAD_H = 19;

const C = {
  ink: rgb(0.1, 0.11, 0.14),
  muted: rgb(0.4, 0.43, 0.46),
  navy: rgb(0.18, 0.24, 0.38),
  navyText: rgb(1, 1, 1),
  rule: rgb(0.82, 0.83, 0.87),
  alt: rgb(0.965, 0.97, 0.98),
  tile: rgb(0.945, 0.95, 0.97),
  good: rgb(0.13, 0.57, 0.33),
  warn: rgb(0.76, 0.49, 0.06),
  bad: rgb(0.76, 0.18, 0.18),
  info: rgb(0.34, 0.2, 0.78),
  neutral: rgb(0.45, 0.47, 0.52),
};

const TILE_COLOUR: Record<ReportTone, RGB> = { good: C.good, warn: C.warn, bad: C.bad, neutral: C.ink };

/** Helvetica (WinAnsi) can't encode every character; replace the ones it can't so pdf-lib never throws on real data. */
const WIN_ANSI_EXTRA = new Set(["–", "—", "‘", "’", "“", "”", "•", "…", "€", "™"]);
export function pdfSafe(input: string): string {
  let out = "";
  for (const ch of input.replace(/→/g, "->").replace(/≥/g, ">=").replace(/≤/g, "<=")) {
    const code = ch.charCodeAt(0);
    out += (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(ch) ? ch : code < 0x20 ? " " : "?";
  }
  return out;
}

const toneColour = (status: string): RGB => {
  switch (statusTone(status)) {
    case "success":
      return C.good;
    case "warning":
      return C.warn;
    case "danger":
      return C.bad;
    case "primary":
      return C.info;
    default:
      return C.neutral;
  }
};

/**
 * Designed multi-page PDF: company header band, title, applied filters, key-figure tiles, then each table with a
 * repeating header row, alternating rows, status pills, a totals row, and "Page i of n" on every page.
 */
export async function buildPdfReport(doc: ExportDocument): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(doc.title));
  pdf.setAuthor("Tobacco ERP · Buyer Portal");
  pdf.setCreationDate(doc.generatedAt);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  let page!: PDFPage;
  let y = 0;
  const bottom = MARGIN + FOOTER_H;

  const text = (t: string, x: number, ty: number, size: number, f: PDFFont, color: RGB = C.ink) =>
    page.drawText(pdfSafe(t), { x, y: ty, size, font: f, color });
  const width = (t: string, size: number, f: PDFFont) => f.widthOfTextAtSize(pdfSafe(t), size);
  const rect = (x: number, ry: number, w: number, h: number, fill: RGB, border?: RGB) =>
    page.drawRectangle({ x, y: ry, width: w, height: h, color: fill, ...(border ? { borderColor: border, borderWidth: 0.4 } : {}) });
  const rule = (ty: number, x1 = MARGIN, x2 = W - MARGIN, color: RGB = C.rule, thickness = 0.4) =>
    page.drawLine({ start: { x: x1, y: ty }, end: { x: x2, y: ty }, thickness, color });

  /** Truncate with an ellipsis so text never spills into the next column. */
  const fit = (t: string, max: number, size: number, f: PDFFont) => {
    const safe = pdfSafe(t);
    if (f.widthOfTextAtSize(safe, size) <= max) return safe;
    let s = safe;
    while (s.length > 1 && f.widthOfTextAtSize(`${s}...`, size) > max) s = s.slice(0, -1);
    return `${s}...`;
  };

  const wrap = (t: string, max: number, size: number, f: PDFFont): string[] => {
    const lines: string[] = [];
    let line = "";
    for (const word of pdfSafe(t).split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(next, size) > max && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };

  const newPage = (first: boolean) => {
    page = pdf.addPage([W, H]);
    y = H - MARGIN;
    if (!first) {
      text(doc.title, MARGIN, y - 9, 9, bold, C.navy);
      text("(continued)", MARGIN + width(doc.title, 9, bold) + 6, y - 9, 8, font, C.muted);
      rule(y - 15, MARGIN, W - MARGIN, C.navy, 0.8);
      y -= 26;
    }
  };
  const ensure = (needed: number) => {
    if (y - needed < bottom) newPage(false);
  };

  // ── Page 1: header band, title, filters, tiles ─────────────────────────────
  newPage(true);
  rect(0, H - 52, W, 52, C.navy);
  text(doc.company, MARGIN, H - 29, 15, bold, C.navyText);
  text("Buyer Portal report", MARGIN, H - 44, 8, font, rgb(0.8, 0.83, 0.92));
  const stamp = `Generated ${formatDocDateTime(doc.generatedAt)} (Harare time)`;
  text(stamp, W - MARGIN - width(stamp, 8, font), H - 29, 8, font, C.navyText);
  const by = `by ${doc.generatedBy}`;
  text(by, W - MARGIN - width(by, 8, font), H - 41, 8, font, rgb(0.8, 0.83, 0.92));
  y = H - 52 - 26;

  text(doc.title, MARGIN, y, 19, bold, C.ink);
  y -= 15;
  if (doc.subtitle) {
    for (const line of wrap(doc.subtitle, BODY_W, 9, font)) {
      text(line, MARGIN, y, 9, font, C.muted);
      y -= 12;
    }
  }
  y -= 4;

  const filterText = doc.filters.length ? doc.filters.map((f) => `${f.label}: ${f.value}`).join("   ·   ") : "none (all records)";
  const filterLines = wrap(filterText, BODY_W - 52, 8, font);
  text("FILTERS", MARGIN, y, 7, bold, C.navy);
  filterLines.forEach((line, i) => text(line, MARGIN + 52, y - i * 11, 8, font, C.ink));
  y -= filterLines.length * 11 + 8;

  if (doc.tiles.length) {
    const cols = Math.min(6, doc.tiles.length);
    const cellW = BODY_W / cols;
    const cellH = 42;
    const rows = Math.ceil(doc.tiles.length / cols);
    ensure(rows * (cellH + 4));
    const top = y;
    doc.tiles.forEach((tile, i) => {
      const x = MARGIN + (i % cols) * cellW;
      const ty = top - Math.floor(i / cols) * (cellH + 4);
      rect(x, ty - cellH, cellW - 4, cellH, C.tile, C.rule);
      rect(x, ty - cellH, 2.5, cellH, TILE_COLOUR[tile.tone ?? "neutral"]);
      text(fit(tile.value, cellW - 18, 14, bold), x + 9, ty - 17, 14, bold, TILE_COLOUR[tile.tone ?? "neutral"]);
      text(fit(tile.label, cellW - 18, 7.5, font), x + 9, ty - 29, 7.5, font, C.ink);
      if (tile.detail) text(fit(tile.detail, cellW - 18, 6.5, font), x + 9, ty - 38, 6.5, font, C.muted);
    });
    y = top - rows * (cellH + 4) - 4;
  }

  // ── Tables ─────────────────────────────────────────────────────────────────
  const layout = (columns: ReportColumnDto[]) => {
    const weights = columns.map((c) => c.width ?? DEFAULT_WEIGHT[c.format]);
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    return weights.map((w) => (BODY_W * w) / sum);
  };

  const drawTable = (section: ExportSection) => {
    const { columns, rows } = section;
    if (section.title) {
      ensure(40);
      y -= 6;
      text(section.title.toUpperCase(), MARGIN, y, 8, bold, C.navy);
      y -= 4;
      rule(y, MARGIN, W - MARGIN, C.navy, 1);
      y -= 10;
    }
    const widths = layout(columns);
    const align = columns.map((c) => c.align ?? defaultAlign(c.format));
    const xs = widths.reduce<number[]>((acc, w, i) => [...acc, (acc[i] ?? MARGIN) + w], [MARGIN]);

    const header = () => {
      ensure(HEAD_H + ROW_H * 2);
      rect(MARGIN, y - HEAD_H, BODY_W, HEAD_H, C.navy);
      columns.forEach((col, i) => {
        const label = fit(col.header, widths[i]! - 8, 7.5, bold);
        const x = align[i] === "right" ? xs[i]! + widths[i]! - width(label, 7.5, bold) - 4 : xs[i]! + 4;
        text(label, x, y - HEAD_H + 6, 7.5, bold, C.navyText);
      });
      y -= HEAD_H;
    };

    const drawRow = (values: Record<string, unknown>, opts: { alt: boolean; total?: boolean }) => {
      if (y - ROW_H < bottom) {
        newPage(false);
        header();
      }
      if (opts.alt) rect(MARGIN, y - ROW_H, BODY_W, ROW_H, C.alt);
      if (opts.total) {
        rule(y, MARGIN, W - MARGIN, C.navy, 0.8);
      }
      columns.forEach((col, i) => {
        const raw = values[col.key] as never;
        const cellText = formatCell(raw, col);
        const maxW = widths[i]! - 8;
        if (col.format === "status" && cellText !== "—") {
          const label = fit(humanizeStatus(String(raw)), maxW - 6, 6.8, bold);
          const pw = width(label, 6.8, bold) + 7;
          const px = align[i] === "right" ? xs[i]! + widths[i]! - pw - 3 : xs[i]! + 3;
          rect(px, y - ROW_H + 3.2, pw, 9, toneColour(String(raw)));
          text(label, px + 3.5, y - ROW_H + 5.8, 6.8, bold, C.navyText);
          return;
        }
        const f = opts.total ? bold : col.format === "mono" ? mono : font;
        const size = col.format === "mono" ? 7.2 : 7.6;
        const shown = fit(cellText, maxW, size, f);
        const x = align[i] === "right" ? xs[i]! + widths[i]! - width(shown, size, f) - 4 : xs[i]! + 4;
        text(shown, x, y - ROW_H + 4.6, size, f, cellText === "—" ? C.muted : C.ink);
      });
      rule(y - ROW_H, MARGIN, W - MARGIN, C.rule, opts.total ? 0.8 : 0.3);
      y -= ROW_H;
    };

    header();
    if (rows.length === 0) {
      text("No records match these filters.", MARGIN + 4, y - 12, 8.5, font, C.muted);
      y -= 22;
    }
    rows.forEach((row, i) => drawRow(row, { alt: i % 2 === 1 }));
    if (section.totals) {
      const totals: Record<string, unknown> = { ...section.totals };
      const first = columns[0]!;
      if (totals[first.key] === undefined || totals[first.key] === null) totals[first.key] = "Total";
      drawRow(totals, { alt: false, total: true });
    }
    y -= 8;
  };

  doc.sections.forEach(drawTable);

  if (doc.notes?.length) {
    ensure(24);
    text("NOTES", MARGIN, y - 4, 7, bold, C.navy);
    y -= 16;
    for (const note of doc.notes) {
      for (const line of wrap(`• ${note}`, BODY_W, 7.5, font)) {
        ensure(11);
        text(line, MARGIN, y, 7.5, font, C.muted);
        y -= 10;
      }
    }
  }

  // ── Footer on every page (needs the final page count) ──────────────────────
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    page = p;
    rule(MARGIN + FOOTER_H - 6, MARGIN, W - MARGIN, C.rule, 0.5);
    text(fit(`${doc.company} · ${doc.title}`, BODY_W - 120, 7, font), MARGIN, MARGIN + 6, 7, font, C.muted);
    const label = `Page ${i + 1} of ${pages.length}`;
    text(label, W - MARGIN - width(label, 7, font), MARGIN + 6, 7, font, C.muted);
  });

  return Buffer.from(await pdf.save());
}
