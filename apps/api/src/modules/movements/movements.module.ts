import { Module } from "@nestjs/common";
import { MovementsController } from "./movements.controller";
import { MovementsService } from "./movements.service";

/** movements — filled in by its stage. Owns everything under modules/movements/. */
@Module({ controllers: [MovementsController], providers: [MovementsService] })
export class MovementsModule {}
