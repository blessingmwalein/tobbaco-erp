import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  companyProfileSchema,
  createBuyerUserSchema,
  createOrganisationSchema,
  pageQuerySchema,
  setOrganisationStatusSchema,
  updateBuyerUserSchema,
  uuidSchema,
  type CompanyProfileInput,
  type CreateBuyerUserInput,
  type CreateOrganisationInput,
  type PageQuery,
  type SetOrganisationStatusInput,
  type UpdateBuyerUserInput,
} from "@tobacco/validation";
import { CurrentBuyer, CurrentStaff, RequireBuyerPermission, ReqMeta, StaffOnly, BuyerOnly, type RequestMeta } from "../../common/decorators";
import type { BuyerPrincipal, StaffPrincipal } from "../../common/principal";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { BuyerAdminService } from "./buyer-admin.service";

const id = new ZodValidationPipe(uuidSchema);
const page = new ZodValidationPipe(pageQuerySchema);

/** ERP staff: manage buyer companies and (on their behalf) their users. */
@ApiTags("staff · buyer organisations")
@ApiBearerAuth()
@StaffOnly()
@Controller("staff/buyer-organisations")
export class StaffBuyerOrganisationsController {
  constructor(@Inject(BuyerAdminService) private readonly svc: BuyerAdminService) {}

  @Get()
  list(@Query(page) q: PageQuery) {
    return this.svc.listOrganisations(q);
  }

  @Post()
  @ApiOperation({ summary: "Create a buyer company with its first Buyer Administrator (activation email is sent)" })
  create(@CurrentStaff() staff: StaffPrincipal, @Body(new ZodValidationPipe(createOrganisationSchema)) body: CreateOrganisationInput, @ReqMeta() meta: RequestMeta) {
    return this.svc.createOrganisation(staff, body, meta);
  }

  @Get(":id")
  get(@Param("id", id) orgId: string) {
    return this.svc.getOrganisation(orgId);
  }

  @Patch(":id")
  update(@CurrentStaff() staff: StaffPrincipal, @Param("id", id) orgId: string, @Body(new ZodValidationPipe(companyProfileSchema)) body: CompanyProfileInput, @ReqMeta() meta: RequestMeta) {
    return this.svc.updateOrganisation(staff, orgId, body, meta);
  }

  @Post(":id/status")
  @HttpCode(200)
  @ApiOperation({ summary: "Activate or deactivate a buyer company (deactivation ends all its users' access at once)" })
  setStatus(@CurrentStaff() staff: StaffPrincipal, @Param("id", id) orgId: string, @Body(new ZodValidationPipe(setOrganisationStatusSchema)) body: SetOrganisationStatusInput, @ReqMeta() meta: RequestMeta) {
    return this.svc.setOrganisationStatus(staff, orgId, body, meta);
  }

  @Get(":id/users")
  users(@Param("id", id) orgId: string, @Query(page) q: PageQuery) {
    return this.svc.listUsers(orgId, q);
  }

  @Post(":id/users")
  createUser(@CurrentStaff() staff: StaffPrincipal, @Param("id", id) orgId: string, @Body(new ZodValidationPipe(createBuyerUserSchema)) body: CreateBuyerUserInput, @ReqMeta() meta: RequestMeta) {
    return this.svc.createUser(staff, orgId, body, meta);
  }

  @Patch(":id/users/:userId")
  updateUser(
    @CurrentStaff() staff: StaffPrincipal,
    @Param("id", id) orgId: string,
    @Param("userId", id) userId: string,
    @Body(new ZodValidationPipe(updateBuyerUserSchema)) body: UpdateBuyerUserInput,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.svc.updateUser(staff, orgId, userId, body, meta);
  }

  @Post(":id/users/:userId/resend-activation")
  @HttpCode(204)
  resend(@CurrentStaff() staff: StaffPrincipal, @Param("id", id) orgId: string, @Param("userId", id) userId: string, @ReqMeta() meta: RequestMeta) {
    return this.svc.resendActivation(staff, orgId, userId, meta);
  }
}

/** A buyer's own company profile. The organisation always comes from the signed-in user — never from the URL. */
@ApiTags("buyer · company")
@ApiBearerAuth()
@Controller("buyer/company")
export class BuyerCompanyController {
  constructor(@Inject(BuyerAdminService) private readonly svc: BuyerAdminService) {}

  @Get()
  @BuyerOnly()
  get(@CurrentBuyer() buyer: BuyerPrincipal) {
    return this.svc.getOrganisation(buyer.organisationId);
  }

  @Patch()
  @RequireBuyerPermission("buyer.company.manage")
  update(@CurrentBuyer() buyer: BuyerPrincipal, @Body(new ZodValidationPipe(companyProfileSchema)) body: CompanyProfileInput, @ReqMeta() meta: RequestMeta) {
    return this.svc.updateOrganisation(buyer, buyer.organisationId, body, meta);
  }
}

/** A buyer administrator manages their own company's users. */
@ApiTags("buyer · users")
@ApiBearerAuth()
@RequireBuyerPermission("buyer.users.manage")
@Controller("buyer/users")
export class BuyerUsersController {
  constructor(@Inject(BuyerAdminService) private readonly svc: BuyerAdminService) {}

  @Get()
  list(@CurrentBuyer() buyer: BuyerPrincipal, @Query(page) q: PageQuery) {
    return this.svc.listUsers(buyer.organisationId, q);
  }

  @Post()
  @ApiOperation({ summary: "Invite a user (an activation email is sent)" })
  create(@CurrentBuyer() buyer: BuyerPrincipal, @Body(new ZodValidationPipe(createBuyerUserSchema)) body: CreateBuyerUserInput, @ReqMeta() meta: RequestMeta) {
    return this.svc.createUser(buyer, buyer.organisationId, body, meta);
  }

  @Patch(":id")
  update(@CurrentBuyer() buyer: BuyerPrincipal, @Param("id", id) userId: string, @Body(new ZodValidationPipe(updateBuyerUserSchema)) body: UpdateBuyerUserInput, @ReqMeta() meta: RequestMeta) {
    return this.svc.updateUser(buyer, buyer.organisationId, userId, body, meta);
  }

  @Post(":id/resend-activation")
  @HttpCode(204)
  resend(@CurrentBuyer() buyer: BuyerPrincipal, @Param("id", id) userId: string, @ReqMeta() meta: RequestMeta) {
    return this.svc.resendActivation(buyer, buyer.organisationId, userId, meta);
  }
}
