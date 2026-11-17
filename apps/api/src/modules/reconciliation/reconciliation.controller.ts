import { Body, Controller, Get, Inject, Param, Post, Query, Res } from "@nestjs/common";
import { reconciliationAllocateSchema, reconciliationCloseSchema, reconciliationQuerySchema, reconciliationReportFormatSchema, type ReconciliationAllocateInput, type ReconciliationCloseInput, type ReconciliationQuery } from "@tobacco/validation";
import { BuyerOnly, CurrentBuyer, RequireBuyerPermission, ReqMeta, type RequestMeta } from "../../common/decorators";
import type { BuyerPrincipal } from "../../common/principal";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import type { Response } from "express";
import { ReconciliationService } from "./reconciliation.service";

@BuyerOnly()
@Controller("buyer/reconciliations")
export class ReconciliationController {
  constructor(@Inject(ReconciliationService) private readonly service: ReconciliationService) {}

  @Get()
  @RequireBuyerPermission("buyer.receiving.view")
  list(@CurrentBuyer() actor: BuyerPrincipal, @Query(new ZodValidationPipe(reconciliationQuerySchema)) q: ReconciliationQuery) { return this.service.list(actor, q); }

  @Get(":purchaseId")
  @RequireBuyerPermission("buyer.receiving.view")
  get(@CurrentBuyer() actor: BuyerPrincipal, @Param("purchaseId") purchaseId: string) { return this.service.get(actor, purchaseId); }

  @Post(":purchaseId/close")
  @RequireBuyerPermission("buyer.receiving.scan")
  close(@CurrentBuyer() actor: BuyerPrincipal, @Param("purchaseId") purchaseId: string, @Body(new ZodValidationPipe(reconciliationCloseSchema)) body: ReconciliationCloseInput, @ReqMeta() meta: RequestMeta) { return this.service.close(actor, purchaseId, body, meta); }

  @Post(":purchaseId/allocate")
  @RequireBuyerPermission("buyer.receiving.scan")
  allocate(@CurrentBuyer() actor: BuyerPrincipal, @Param("purchaseId") purchaseId: string, @Body(new ZodValidationPipe(reconciliationAllocateSchema)) body: ReconciliationAllocateInput, @ReqMeta() meta: RequestMeta) { return this.service.allocate(actor, purchaseId, body, meta); }

  @Get(":purchaseId/report")
  @RequireBuyerPermission("buyer.reports.view")
  async report(@CurrentBuyer() actor: BuyerPrincipal, @Param("purchaseId") purchaseId: string, @Query("format") format: string, @Res() response: Response) {
    const fmt = (reconciliationReportFormatSchema.safeParse(format).success ? format : "pdf") as "pdf" | "csv" | "json";
    const file = await this.service.export(actor, purchaseId, fmt);
    response.set({ "Content-Type": file.mimeType, "Content-Disposition": `attachment; filename="${file.filename}"`, "Content-Length": String(file.data.length) });
    response.send(file.data);
  }
}
