import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { confirmProcessingReturnSchema, createProcessingReturnSchema, uuidSchema, type ConfirmProcessingReturnInput, type CreateProcessingReturnInput } from "@tobacco/validation";
import { BuyerOnly, CurrentBuyer, RequireBuyerPermission, ReqMeta, type RequestMeta } from "../../common/decorators";
import type { BuyerPrincipal } from "../../common/principal";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { ReturnsService } from "./returns.service";
@ApiTags("buyer · processing returns")
@ApiBearerAuth()
@BuyerOnly()
@Controller("buyer/processing/returns")
export class ReturnsController {
  constructor(@Inject(ReturnsService) private readonly svc: ReturnsService) {}
  @Get(":id") @RequireBuyerPermission("buyer.processing.view")
  get(@CurrentBuyer() p: BuyerPrincipal, @Param("id", new ZodValidationPipe(uuidSchema)) id: string) { return this.svc.get(p.organisationId, id); }
  @Post() @RequireBuyerPermission("buyer.returns.receive")
  start(@CurrentBuyer() p: BuyerPrincipal, @Body(new ZodValidationPipe(createProcessingReturnSchema)) body: CreateProcessingReturnInput, @ReqMeta() m: RequestMeta) { return this.svc.start(p, body, m); }
  @Post(":id/confirm") @RequireBuyerPermission("buyer.returns.receive")
  confirm(@CurrentBuyer() p: BuyerPrincipal, @Param("id", new ZodValidationPipe(uuidSchema)) id: string, @Body(new ZodValidationPipe(confirmProcessingReturnSchema)) body: ConfirmProcessingReturnInput, @ReqMeta() m: RequestMeta) { return this.svc.confirm(p, id, body, m); }
}
