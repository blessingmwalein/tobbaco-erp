import { Controller, Get, Inject, Param, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { ReportId } from "@tobacco/shared";
import { reportExportQuerySchema, reportIdSchema, reportQuerySchema, type ReportExportQuery, type ReportQuery } from "@tobacco/validation";
import { CurrentBuyer, RequireBuyerPermission, ReqMeta, type RequestMeta } from "../../common/decorators";
import type { BuyerPrincipal } from "../../common/principal";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { ReportsService } from "./reports.service";

const reportId = new ZodValidationPipe(reportIdSchema);

@ApiTags("buyer · reports")
@ApiBearerAuth()
@Controller("buyer/reports")
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}

  @Get(":reportId")
  @RequireBuyerPermission("buyer.reports.view")
  @ApiOperation({ summary: "Run a report: one page of rows plus key figures and totals over the whole filtered set" })
  run(@CurrentBuyer() buyer: BuyerPrincipal, @Param("reportId", reportId) id: ReportId, @Query(new ZodValidationPipe(reportQuerySchema)) query: ReportQuery) {
    return this.reports.run(buyer, id, query);
  }

  @Get(":reportId/export")
  @RequireBuyerPermission("buyer.reports.view", "buyer.reports.export")
  @ApiOperation({ summary: "Export EVERY matching row as pdf, xlsx or csv (audited)" })
  async export(
    @CurrentBuyer() buyer: BuyerPrincipal,
    @Param("reportId", reportId) id: ReportId,
    @Query(new ZodValidationPipe(reportExportQuerySchema)) query: ReportExportQuery,
    @ReqMeta() meta: RequestMeta,
    @Res() response: Response,
  ) {
    const file = await this.reports.export(buyer, id, query, meta);
    response.set({
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Content-Length": String(file.data.length),
      "Cache-Control": "no-store",
    });
    response.send(file.data);
  }
}
