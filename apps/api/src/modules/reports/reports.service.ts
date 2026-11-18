import { Inject, Injectable } from "@nestjs/common";
import {
  REPORTS_BY_ID,
  type ReportAppliedFilter,
  type ReportDefinition,
  type ReportId,
  type ReportResultDto,
} from "@tobacco/shared";
import type { ReportExportQuery, ReportFilters, ReportQuery } from "@tobacco/validation";
import { AppError } from "../../common/app-error";
import type { RequestMeta } from "../../common/decorators";
import { buildExport, formatDocDate, harareParts, type ExportDocument, type ExportFile } from "../../common/export";
import type { BuyerPrincipal } from "../../common/principal";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { REPORT_RUNNERS } from "./reports.registry";
import type { Paging, ReportData } from "./reports.types";

type Sort = { key: string; dir: "asc" | "desc" };

@Injectable()
export class ReportsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** The catalogue entry, or 404. */
  definition(id: ReportId): ReportDefinition {
    const def = REPORTS_BY_ID[id];
    if (!def) throw AppError.notFound("Report");
    return def;
  }

  /** `buyer.reports.view` is checked by the route; each report adds the permission of the data it shows. */
  private assertAllowed(principal: BuyerPrincipal, def: ReportDefinition): void {
    const missing = def.requires.filter((p) => !principal.permissions.has(p));
    if (missing.length) throw AppError.forbidden(`Your role cannot open the ${def.title} report`, "PERMISSION_DENIED", { missing });
  }

  /** Keep only the filters this report declares, validate coded values against its options, and resolve the sort. */
  private normalise(def: ReportDefinition, q: ReportFilters & { sort?: string; dir?: "asc" | "desc" }): { filters: ReportFilters; sort: Sort } {
    const has = (k: ReportDefinition["filters"][number]) => def.filters.includes(k);
    const filters: ReportFilters = {
      from: has("dateRange") ? q.from : undefined,
      to: has("dateRange") ? q.to : undefined,
      floor: has("floor") ? q.floor : undefined,
      search: has("search") ? q.search : undefined,
      status: has("status") ? q.status : undefined,
      kind: has("kind") ? q.kind : undefined,
      purchaseId: has("purchaseId") ? q.purchaseId : undefined,
      warehouseId: has("warehouseId") ? q.warehouseId : undefined,
      bayId: has("bayId") ? q.bayId : undefined,
      grade: has("grade") ? q.grade : undefined,
      onlyVariances: has("onlyVariances") ? q.onlyVariances : false,
      includeEmpty: has("includeEmpty") ? q.includeEmpty : false,
    };
    const check = (name: string, value: string | undefined, options?: Array<{ value: string }>) => {
      if (value && options && !options.some((o) => o.value === value)) {
        throw AppError.unprocessable("INVALID_FILTER", `"${value}" is not a valid ${name} for this report`);
      }
    };
    check(def.statusLabel ?? "status", filters.status, def.statusOptions);
    check(def.kindLabel ?? "type", filters.kind, def.kindOptions);

    const sortable = new Set(def.columns.filter((c) => c.sortable).map((c) => c.key));
    const sort: Sort = q.sort && sortable.has(q.sort) ? { key: q.sort, dir: q.dir ?? "asc" } : filters.onlyVariances && def.varianceSort ? def.varianceSort : def.defaultSort;
    return { filters, sort };
  }

  /** Human-readable filters for the page, the PDF header and the Excel summary. Also proves referenced ids belong to this company. */
  private async describeFilters(orgId: string, def: ReportDefinition, f: ReportFilters): Promise<ReportAppliedFilter[]> {
    const db = this.prisma.forOrganisation(orgId);
    const out: ReportAppliedFilter[] = [];
    if (f.from || f.to) {
      const from = f.from ? formatDocDate(f.from) : null;
      const to = f.to ? formatDocDate(f.to) : null;
      out.push({ label: def.dateLabel ?? "Date", value: from && to ? (from === to ? from : `${from} – ${to}`) : from ? `from ${from}` : `until ${to}` });
    }
    if (f.floor) out.push({ label: "Floor", value: f.floor });
    if (f.purchaseId) {
      const p = await db.purchase.findUnique({ where: { id: f.purchaseId }, select: { reference: true } });
      if (!p) throw AppError.notFound("Purchase");
      out.push({ label: "Purchase", value: p.reference });
    }
    if (f.warehouseId) {
      const w = await db.warehouse.findUnique({ where: { id: f.warehouseId }, select: { code: true, name: true } });
      if (!w) throw AppError.notFound("Warehouse");
      out.push({ label: "Warehouse", value: `${w.code} · ${w.name}` });
    }
    if (f.bayId) {
      const b = await db.bay.findUnique({ where: { id: f.bayId }, select: { code: true } });
      if (!b) throw AppError.notFound("Bay");
      out.push({ label: "Bay", value: b.code });
    }
    if (f.status) out.push({ label: def.statusLabel ?? "Status", value: def.statusOptions?.find((o) => o.value === f.status)?.label ?? f.status });
    if (f.kind) out.push({ label: def.kindLabel ?? "Type", value: def.kindOptions?.find((o) => o.value === f.kind)?.label ?? f.kind });
    if (f.grade) out.push({ label: "Grade", value: f.grade });
    if (f.search) out.push({ label: "Search", value: `"${f.search}"` });
    if (f.onlyVariances) out.push({ label: "Show", value: "only with differences" });
    if (f.includeEmpty) out.push({ label: "Show", value: "including empty rows" });
    return out;
  }

  private async execute(principal: BuyerPrincipal, def: ReportDefinition, filters: ReportFilters, sort: Sort, paging: Paging): Promise<ReportData> {
    return REPORT_RUNNERS[def.id]({
      db: this.prisma.forOrganisation(principal.organisationId),
      orgId: principal.organisationId,
      filters,
      paging,
      sort,
      now: new Date(),
    });
  }

  async run(principal: BuyerPrincipal, id: ReportId, q: ReportQuery): Promise<ReportResultDto> {
    const def = this.definition(id);
    this.assertAllowed(principal, def);
    const { filters, sort } = this.normalise(def, q);
    const applied = await this.describeFilters(principal.organisationId, def, filters);
    const data = await this.execute(principal, def, filters, sort, { page: q.page, pageSize: q.pageSize });
    return {
      reportId: def.id,
      area: def.area,
      title: def.title,
      description: def.description,
      generatedAt: new Date().toISOString(),
      filters: applied,
      columns: def.columns,
      rows: data.rows,
      totals: data.totals,
      tiles: data.tiles,
      total: data.total,
      page: q.page,
      pageSize: q.pageSize,
      notes: [...(def.notes ?? []), ...(data.notes ?? [])],
    };
  }

  /** Every row matching the filters (not just a page) as a PDF, Excel workbook or CSV. The export is audited. */
  async export(principal: BuyerPrincipal, id: ReportId, q: ReportExportQuery, meta: RequestMeta): Promise<ExportFile> {
    const def = this.definition(id);
    this.assertAllowed(principal, def);
    const { filters, sort } = this.normalise(def, q);
    const applied = await this.describeFilters(principal.organisationId, def, filters);
    const data = await this.execute(principal, def, filters, sort, "all");
    const generatedAt = new Date();

    const doc: ExportDocument = {
      title: def.title,
      subtitle: def.description,
      company: principal.organisationName,
      generatedAt,
      generatedBy: principal.name,
      filters: applied,
      tiles: data.tiles,
      sections: [{ sheetName: def.sheetName ?? def.title, columns: def.columns, rows: data.rows, totals: data.totals }],
      notes: [...(def.notes ?? []), ...(data.notes ?? [])],
    };
    const range = filters.from || filters.to ? `${filters.from ?? "start"}_to_${filters.to ?? "today"}` : harareParts(generatedAt).day;
    const file = await buildExport(doc, q.format, `${def.id}_${range}`);

    await this.audit.record(
      undefined,
      principal,
      { action: "report.exported", entityType: "Report", entityRef: def.id, next: { format: q.format, rows: data.rows.length, filters: applied, filename: file.filename }, organisationId: principal.organisationId },
      meta,
    );
    return file;
  }
}
