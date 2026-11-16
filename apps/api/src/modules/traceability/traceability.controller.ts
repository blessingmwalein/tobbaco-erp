import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { BuyerOnly, CurrentBuyer, RequireBuyerPermission } from "../../common/decorators";
import type { BuyerPrincipal } from "../../common/principal";
import { TraceabilityService } from "./traceability.service";

@ApiTags("buyer · traceability")
@ApiBearerAuth()
@BuyerOnly()
@Controller("buyer/traceability")
export class TraceabilityController {
  constructor(@Inject(TraceabilityService) private readonly service: TraceabilityService) {}

  @Get("bales/:barcode/timeline")
  @RequireBuyerPermission("buyer.traceability.view")
  timeline(@CurrentBuyer() buyer: BuyerPrincipal, @Param("barcode") barcode: string) {
    return this.service.timeline(buyer.organisationId, barcode);
  }

  @Get(":barcode")
  @RequireBuyerPermission("buyer.traceability.view")
  get(@CurrentBuyer() buyer: BuyerPrincipal, @Param("barcode") barcode: string) {
    return this.service.timeline(buyer.organisationId, barcode);
  }
}
