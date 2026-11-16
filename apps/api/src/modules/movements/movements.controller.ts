import { Body, Controller, Get, Inject, Post, Query } from "@nestjs/common";
import { movementSchema } from "@tobacco/validation";
import { CurrentBuyer, RequireBuyerPermission, ReqMeta, type RequestMeta } from "../../common/decorators";
import type { BuyerPrincipal } from "../../common/principal";
import { MovementsService } from "./movements.service";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";

@Controller("movements")
export class MovementsController {
  constructor(@Inject(MovementsService) private readonly service: MovementsService) {}
  @Get() @RequireBuyerPermission("buyer.warehouse.view") list(@CurrentBuyer() p: BuyerPrincipal, @Query() q: any) { return this.service.list(p, q); }
  @Post() @RequireBuyerPermission("buyer.warehouse.move") move(@CurrentBuyer() p: BuyerPrincipal, @Body(new ZodValidationPipe(movementSchema)) b: any, @ReqMeta() m: RequestMeta) { return this.service.move(p, b, m); }
  @Get("reconciliation") @RequireBuyerPermission("buyer.warehouse.view") reconcile(@CurrentBuyer() p: BuyerPrincipal) { return this.service.reconcile(p); }
}
