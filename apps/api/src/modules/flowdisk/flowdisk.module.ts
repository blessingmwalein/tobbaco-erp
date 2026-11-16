import { Module } from "@nestjs/common";
import { FlowdiskController } from "./flowdisk.controller";
import { FlowdiskService } from "./flowdisk.service";

/** Flow Disk staging, duplicate detection and confirmation module. */
@Module({ controllers: [FlowdiskController], providers: [FlowdiskService] })
export class FlowdiskModule {}
