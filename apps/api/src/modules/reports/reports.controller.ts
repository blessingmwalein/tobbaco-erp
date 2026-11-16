import { Controller, Get, Inject, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { reportQuerySchema, type ReportQuery } from "@tobacco/validation";
import { BuyerOnly, CurrentBuyer, RequireBuyerPermission } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import type { BuyerPrincipal } from "../../common/principal";
import { ReportsService } from "./reports.service";

@ApiTags("buyer · reports")
@ApiBearerAuth()
@BuyerOnly()
@Controller("buyer/reports")
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly service: ReportsService) {}

  @Get()
  @RequireBuyerPermission("buyer.reports.view")
  list(@CurrentBuyer() buyer: BuyerPrincipal, @Query(new ZodValidationPipe(reportQuerySchema)) q: ReportQuery) {
    return this.service.list(buyer.organisationId, q);
  }

  @Get("export")
  @RequireBuyerPermission("buyer.reports.export")
  async export(@CurrentBuyer() buyer: BuyerPrincipal, @Query(new ZodValidationPipe(reportQuerySchema)) q: ReportQuery, @Res() response: Response) {
    const format = q.format === "xlsx" ? "xlsx" : "pdf";
    const file = await this.service.export(buyer.organisationId, q, format);
    response.set({ "Content-Type": file.mimeType, "Content-Disposition": `attachment; filename="${file.filename}"`, "Content-Length": String(file.data.length) });
    response.send(file.data);
  }
}
