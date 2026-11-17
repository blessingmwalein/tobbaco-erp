import { Module } from "@nestjs/common";
import { ReconciliationController } from "./reconciliation.controller";
import { ReconciliationService } from "./reconciliation.service";

/** Purchase-level reconciliation: aggregate shipments + receiving, close, report, and final warehouse allocation. */
@Module({ controllers: [ReconciliationController], providers: [ReconciliationService], exports: [ReconciliationService] })
export class ReconciliationModule {}
