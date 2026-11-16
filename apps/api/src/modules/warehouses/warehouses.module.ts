import { Module } from "@nestjs/common";
import { WarehousesController } from "./warehouses.controller";
import { WarehousesService } from "./warehouses.service";

/** warehouses — filled in by its stage. Owns everything under modules/warehouses/. */
@Module({ controllers: [WarehousesController], providers: [WarehousesService] })
export class WarehousesModule {}
