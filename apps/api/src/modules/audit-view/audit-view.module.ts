import { Module } from "@nestjs/common";
import { AuditViewController } from "./audit-view.controller";
import { AuditViewService } from "./audit-view.service";

/** audit-view — filled in by its stage. Owns everything under modules/audit-view/. */
@Module({ controllers: [AuditViewController], providers: [AuditViewService] })
export class AuditViewModule {}
