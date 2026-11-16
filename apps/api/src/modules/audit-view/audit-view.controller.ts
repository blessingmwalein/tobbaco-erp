import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { auditQuerySchema, type AuditQuery } from "@tobacco/validation";
import { BuyerOnly, CurrentBuyer, RequireBuyerPermission } from "../../common/decorators";
import type { BuyerPrincipal } from "../../common/principal";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { AuditViewService } from "./audit-view.service";

@ApiTags("buyer · audit")
@ApiBearerAuth()
@BuyerOnly()
@Controller("buyer/audit")
export class AuditViewController {
  constructor(@Inject(AuditViewService) private readonly service: AuditViewService) {}

  @Get()
  @RequireBuyerPermission("buyer.audit.view")
  list(@CurrentBuyer() buyer: BuyerPrincipal, @Query(new ZodValidationPipe(auditQuerySchema)) q: AuditQuery) {
    return this.service.list(buyer.organisationId, q);
  }
}
