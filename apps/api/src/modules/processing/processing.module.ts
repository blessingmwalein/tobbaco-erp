import { Module } from "@nestjs/common";
import { ProcessingController } from "./processing.controller";
import { ProcessingService } from "./processing.service";

/** processing — filled in by its stage. Owns everything under modules/processing/. */
@Module({ controllers: [ProcessingController], providers: [ProcessingService], exports: [ProcessingService] })
export class ProcessingModule {}
