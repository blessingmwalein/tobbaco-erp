import { Module } from "@nestjs/common";
import { TraceabilityController } from "./traceability.controller";
import { TraceabilityService } from "./traceability.service";

/** traceability — filled in by its stage. Owns everything under modules/traceability/. */
@Module({ controllers: [TraceabilityController], providers: [TraceabilityService] })
export class TraceabilityModule {}
