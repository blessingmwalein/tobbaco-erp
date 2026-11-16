import { Body, Controller, Delete, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { buyerShipmentArrivalSchema, buyerShipmentImportSchema } from "@tobacco/validation";
import { BuyerOnly, CurrentBuyer, RequireBuyerPermission, ReqMeta, type RequestMeta } from "../../common/decorators";
import type { BuyerPrincipal } from "../../common/principal";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { ShipmentsService } from "./shipments.service";

@BuyerOnly()
@Controller("buyer/shipments")
export class ShipmentsController {
  constructor(@Inject(ShipmentsService) private readonly service: ShipmentsService) {}

  @Get()
  @RequireBuyerPermission("buyer.receiving.view")
  list(@CurrentBuyer() actor: BuyerPrincipal, @Query() query: { status?: string; search?: string }) { return this.service.list(actor, query); }

  @Get(":id")
  @RequireBuyerPermission("buyer.receiving.view")
  get(@CurrentBuyer() actor: BuyerPrincipal, @Param("id") id: string) { return this.service.get(actor, id); }

  @Post("import")
  @RequireBuyerPermission("buyer.flowdisk.import")
  stage(@CurrentBuyer() actor: BuyerPrincipal, @Body(new ZodValidationPipe(buyerShipmentImportSchema)) body: any, @ReqMeta() meta: RequestMeta) { return this.service.stage(actor, body, meta); }

  @Post("imports/:id/confirm")
  @RequireBuyerPermission("buyer.flowdisk.import")
  confirm(@CurrentBuyer() actor: BuyerPrincipal, @Param("id") id: string, @ReqMeta() meta: RequestMeta) { return this.service.confirm(actor, id, meta); }

  @Post(":id/arrive")
  @RequireBuyerPermission("buyer.receiving.scan")
  arrive(@CurrentBuyer() actor: BuyerPrincipal, @Param("id") id: string, @Body(new ZodValidationPipe(buyerShipmentArrivalSchema)) body: any, @ReqMeta() meta: RequestMeta) { return this.service.arrive(actor, id, body, meta); }
}
