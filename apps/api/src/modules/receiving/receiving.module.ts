import { Module } from "@nestjs/common";
import { ReceivingController } from "./receiving.controller";
import { ReceivingService } from "./receiving.service";

/** receiving — filled in by its stage. Owns everything under modules/receiving/. */
@Module({ controllers: [ReceivingController], providers: [ReceivingService] })
export class ReceivingModule {}
