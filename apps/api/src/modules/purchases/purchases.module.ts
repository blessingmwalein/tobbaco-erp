import { Module } from "@nestjs/common";
import { PurchasesController } from "./purchases.controller";
import { PurchasesService } from "./purchases.service";

/** Buyer invoice, purchase and bale-manifest read endpoints. */
@Module({ controllers: [PurchasesController], providers: [PurchasesService] })
export class PurchasesModule {}
