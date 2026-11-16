import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { dashboardQuerySchema, type DashboardQuery } from "@tobacco/validation";
import { BuyerOnly, CurrentBuyer, RequireBuyerPermission } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import type { BuyerPrincipal } from "../../common/principal";
import { DashboardService } from "./dashboard.service";

@ApiTags("buyer · dashboard")
@ApiBearerAuth()
@BuyerOnly()
@Controller("buyer/dashboard")
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly service: DashboardService) {}

  @Get()
  @RequireBuyerPermission("buyer.dashboard.view")
  get(@CurrentBuyer() buyer: BuyerPrincipal, @Query(new ZodValidationPipe(dashboardQuerySchema)) query: DashboardQuery) {
    return this.service.get(buyer.organisationId, query);
  }
}
