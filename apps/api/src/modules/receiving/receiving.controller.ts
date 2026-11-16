import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { receivingConfirmSchema, receivingExceptionResolveSchema, receivingScanSchema, receivingSessionSchema } from "@tobacco/validation";
import { RequireBuyerPermission, CurrentBuyer, ReqMeta, type RequestMeta } from "../../common/decorators";
import type { BuyerPrincipal } from "../../common/principal";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { ReceivingService } from "./receiving.service";

@Controller("receiving")
export class ReceivingController {
  constructor(@Inject(ReceivingService) private readonly service: ReceivingService) {}
  @Get("sessions") @RequireBuyerPermission("buyer.receiving.view") list(@CurrentBuyer() p: BuyerPrincipal, @Query() q: any) { return this.service.list(p, q); }
  @Get("sessions/:id") @RequireBuyerPermission("buyer.receiving.view") get(@CurrentBuyer() p: BuyerPrincipal, @Param("id") id: string) { return this.service.get(p, id); }
  @Post("sessions") @RequireBuyerPermission("buyer.receiving.scan") start(@CurrentBuyer() p: BuyerPrincipal, @Body(new ZodValidationPipe(receivingSessionSchema)) b: any, @ReqMeta() m: RequestMeta) { return this.service.start(p, b, m); }
  @Post("sessions/:id/scans") @RequireBuyerPermission("buyer.receiving.scan") scan(@CurrentBuyer() p: BuyerPrincipal, @Param("id") id: string, @Body(new ZodValidationPipe(receivingScanSchema)) b: any, @ReqMeta() m: RequestMeta) { return this.service.scan(p, id, b, m); }
  @Post("sessions/:id/confirm") @RequireBuyerPermission("buyer.receiving.scan") confirm(@CurrentBuyer() p: BuyerPrincipal, @Param("id") id: string, @ReqMeta() m: RequestMeta) { return this.service.confirm(p, id, m); }
  @Post("sessions/:id/finalise") @RequireBuyerPermission("buyer.receiving.scan") finalise(@CurrentBuyer() p: BuyerPrincipal, @Param("id") id: string, @Body(new ZodValidationPipe(receivingConfirmSchema)) b: any, @ReqMeta() m: RequestMeta) { return this.service.finalise(p, id, b, m); }
  @Post("sessions/:id/exceptions/:exceptionId/resolve") @RequireBuyerPermission("buyer.receiving.scan") resolveException(@CurrentBuyer() p: BuyerPrincipal, @Param("id") id: string, @Param("exceptionId") exceptionId: string, @Body(new ZodValidationPipe(receivingExceptionResolveSchema)) b: any, @ReqMeta() m: RequestMeta) { return this.service.resolveException(p, id, exceptionId, b.resolution, m); }
}
