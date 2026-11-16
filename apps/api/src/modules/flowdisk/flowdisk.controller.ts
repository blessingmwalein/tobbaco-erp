import { Body, Controller, Delete, Get, Inject, Param, Post } from "@nestjs/common";
import { RequireBuyerPermission, CurrentBuyer, ReqMeta, type RequestMeta } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { createFlowDiskImportSchema, confirmFlowDiskImportSchema, type CreateFlowDiskImportInput, type ConfirmFlowDiskImportInput } from "@tobacco/validation";
import type { BuyerPrincipal } from "../../common/principal";
import { FlowdiskService } from "./flowdisk.service";

@Controller("buyer/flowdisk/imports")
@RequireBuyerPermission("buyer.flowdisk.import")
export class FlowdiskController {
  constructor(@Inject(FlowdiskService) private readonly service: FlowdiskService) {}
  @Get() list(@CurrentBuyer() buyer: BuyerPrincipal) { return this.service.list(buyer); }
  @Post() stage(@CurrentBuyer() buyer: BuyerPrincipal, @Body(new ZodValidationPipe(createFlowDiskImportSchema)) body: CreateFlowDiskImportInput, @ReqMeta() meta: RequestMeta) { return this.service.stage(buyer, body, meta); }
  @Get(":id") get(@CurrentBuyer() buyer: BuyerPrincipal, @Param("id") id: string) { return this.service.get(buyer, id); }
  @Delete(":id") remove(@CurrentBuyer() buyer: BuyerPrincipal, @Param("id") id: string, @ReqMeta() meta: RequestMeta) { return this.service.remove(buyer, id, meta); }
  @Post(":id/confirm") confirm(@CurrentBuyer() buyer: BuyerPrincipal, @Param("id") id: string, @Body(new ZodValidationPipe(confirmFlowDiskImportSchema)) body: ConfirmFlowDiskImportInput, @ReqMeta() meta: RequestMeta) { return this.service.confirm(buyer, id, body, meta); }
}
