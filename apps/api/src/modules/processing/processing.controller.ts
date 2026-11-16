import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { createDispatchSchema, createProcessingCompanySchema, dispatchQuerySchema, pageQuerySchema, processingCompanyStatusSchema, updateProcessingCompanySchema, uuidSchema, type CreateDispatchInput, type CreateProcessingCompanyInput, type DispatchQuery, type PageQuery, type UpdateProcessingCompanyInput } from "@tobacco/validation";
import { BuyerOnly, CurrentBuyer, RequireBuyerPermission, ReqMeta, type RequestMeta } from "../../common/decorators";
import { AppError } from "../../common/app-error";
import type { BuyerPrincipal } from "../../common/principal";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { ProcessingService } from "./processing.service";

const uuid = new ZodValidationPipe(uuidSchema);
const page = new ZodValidationPipe(pageQuerySchema);
@ApiTags("buyer · processing")
@ApiBearerAuth()
@BuyerOnly()
@Controller("buyer/processing")
export class ProcessingController {
  constructor(@Inject(ProcessingService) private readonly svc: ProcessingService) {}
  @Get("companies") @RequireBuyerPermission("buyer.processing.view")
  companies(@CurrentBuyer() p: BuyerPrincipal, @Query(page) q: PageQuery) { return this.svc.listCompanies(p.organisationId, q); }
  @Get("companies/:id") @RequireBuyerPermission("buyer.processing.view")
  company(@CurrentBuyer() p: BuyerPrincipal, @Param("id", uuid) id: string) { return this.svc.getCompany(p.organisationId, id); }
  @Post("companies") @RequireBuyerPermission("buyer.processing.companies")
  createCompany(@CurrentBuyer() p: BuyerPrincipal, @Body(new ZodValidationPipe(createProcessingCompanySchema)) body: CreateProcessingCompanyInput, @ReqMeta() m: RequestMeta) { return this.svc.createCompany(p, body, m); }
  @Patch("companies/:id") @RequireBuyerPermission("buyer.processing.companies")
  updateCompany(@CurrentBuyer() p: BuyerPrincipal, @Param("id", uuid) id: string, @Body(new ZodValidationPipe(updateProcessingCompanySchema)) body: UpdateProcessingCompanyInput, @ReqMeta() m: RequestMeta) { return this.svc.updateCompany(p, id, body, m); }
  @Post("companies/:id/status") @RequireBuyerPermission("buyer.processing.companies")
  status(@CurrentBuyer() p: BuyerPrincipal, @Param("id", uuid) id: string, @Body(new ZodValidationPipe(processingCompanyStatusSchema)) body: { active: boolean }, @ReqMeta() m: RequestMeta) { return this.svc.setCompanyStatus(p, id, body.active, m); }
  @Get("dispatches") @RequireBuyerPermission("buyer.processing.view")
  dispatches(@CurrentBuyer() p: BuyerPrincipal, @Query(new ZodValidationPipe(dispatchQuerySchema)) q: DispatchQuery) { return this.svc.listDispatches(p.organisationId, q); }
  @Get("dispatches/:id") @RequireBuyerPermission("buyer.processing.view")
  dispatch(@CurrentBuyer() p: BuyerPrincipal, @Param("id", uuid) id: string) { return this.svc.getDispatch(p.organisationId, id); }
  @Post("dispatches") @RequireBuyerPermission("buyer.dispatch.create")
  dispatchBales(@CurrentBuyer() p: BuyerPrincipal, @Body(new ZodValidationPipe(createDispatchSchema)) body: CreateDispatchInput, @ReqMeta() m: RequestMeta) { return this.svc.createDispatch(p, body, m); }
  @Post("dispatches/:id/document") @RequireBuyerPermission("buyer.dispatch.create") @UseInterceptors(FileInterceptor("file"))
  document(@CurrentBuyer() p: BuyerPrincipal, @Param("id", uuid) id: string, @UploadedFile() file: { originalname: string; mimetype: string; buffer: Buffer }, @ReqMeta() m: RequestMeta) {
    if (!file) throw AppError.unprocessable("DOCUMENT_REQUIRED", "A dispatch document is required");
    return this.svc.attachDispatchDocument(p, id, file, m);
  }
}
