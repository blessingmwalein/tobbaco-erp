import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

/** reports — filled in by its stage. Owns everything under modules/reports/. */
@Module({ controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
