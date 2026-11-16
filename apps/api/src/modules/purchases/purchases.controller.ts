import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { RequireBuyerPermission, CurrentBuyer } from "../../common/decorators";
import type { BuyerPrincipal } from "../../common/principal";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { invoiceQuerySchema, pageQuerySchema, purchaseQuerySchema, type InvoiceQuery, type PageQuery, type PurchaseQuery } from "@tobacco/validation";
import { PurchasesService } from "./purchases.service";

const page = new ZodValidationPipe(pageQuerySchema);
const invoicePage = new ZodValidationPipe(invoiceQuerySchema);
const purchasePage = new ZodValidationPipe(purchaseQuerySchema);
@Controller("buyer")
export class PurchasesController {
  constructor(@Inject(PurchasesService) private readonly service: PurchasesService) {}
  @Get("purchases") @RequireBuyerPermission("buyer.purchases.view")
  purchases(@CurrentBuyer() b: BuyerPrincipal, @Query(purchasePage) q: PurchaseQuery) { return this.service.listPurchases(b, q); }
  @Get("purchases/:id") @RequireBuyerPermission("buyer.purchases.view")
  purchase(@CurrentBuyer() b: BuyerPrincipal, @Param("id") id: string) { return this.service.getPurchase(b, id); }
  @Get("purchases/:id/bales") @RequireBuyerPermission("buyer.purchases.view")
  bales(@CurrentBuyer() b: BuyerPrincipal, @Param("id") id: string, @Query(page) q: PageQuery) { return this.service.listBales(b, id, q); }
  @Get("invoices") @RequireBuyerPermission("buyer.invoices.view")
  invoices(@CurrentBuyer() b: BuyerPrincipal, @Query(invoicePage) q: InvoiceQuery) { return this.service.listInvoices(b, q); }
  @Get("invoices/:id") @RequireBuyerPermission("buyer.invoices.view")
  invoice(@CurrentBuyer() b: BuyerPrincipal, @Param("id") id: string) { return this.service.getInvoice(b, id); }
}
