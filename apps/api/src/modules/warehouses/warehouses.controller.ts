import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { baySchema, rowSchema, warehouseSchema, warehouseUpdateSchema } from "@tobacco/validation";
import { CurrentBuyer, RequireBuyerPermission, ReqMeta, type RequestMeta } from "../../common/decorators";
import type { BuyerPrincipal } from "../../common/principal";
import { WarehousesService } from "./warehouses.service";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";

@Controller("warehouses")
export class WarehousesController {
  constructor(@Inject(WarehousesService) private readonly service: WarehousesService) {}
  @Get() @RequireBuyerPermission("buyer.warehouse.view") list(@CurrentBuyer() p: BuyerPrincipal) { return this.service.list(p); }
  @Get(":id") @RequireBuyerPermission("buyer.warehouse.view") get(@CurrentBuyer() p: BuyerPrincipal, @Param("id") id: string) { return this.service.get(p, id); }
  @Post() @RequireBuyerPermission("buyer.warehouse.manage") create(@CurrentBuyer() p: BuyerPrincipal, @Body(new ZodValidationPipe(warehouseSchema)) b: any, @ReqMeta() m: RequestMeta) { return this.service.create(p, b, m); }
  @Patch(":id") @RequireBuyerPermission("buyer.warehouse.manage") update(@CurrentBuyer() p: BuyerPrincipal, @Param("id") id: string, @Body(new ZodValidationPipe(warehouseUpdateSchema)) b: any, @ReqMeta() m: RequestMeta) { return this.service.update(p, id, b, m); }
  @Post(":id/bays") @RequireBuyerPermission("buyer.warehouse.manage") bay(@CurrentBuyer() p: BuyerPrincipal, @Param("id") id: string, @Body(new ZodValidationPipe(baySchema)) b: any, @ReqMeta() m: RequestMeta) { return this.service.createBay(p, id, b, m); }
  @Post("bays/:id/rows") @RequireBuyerPermission("buyer.warehouse.manage") row(@CurrentBuyer() p: BuyerPrincipal, @Param("id") id: string, @Body(new ZodValidationPipe(rowSchema)) b: any, @ReqMeta() m: RequestMeta) { return this.service.createRow(p, id, b, m); }
  @Get(":id/inventory") @RequireBuyerPermission("buyer.warehouse.view") inventory(@CurrentBuyer() p: BuyerPrincipal, @Param("id") id: string, @Query() q: any) { return this.service.inventory(p, id, q); }
}
