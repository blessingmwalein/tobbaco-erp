import { Module } from "@nestjs/common";
import { BuyerCompanyController, BuyerUsersController, StaffBuyerOrganisationsController } from "./buyer-admin.controllers";
import { BuyerAdminService } from "./buyer-admin.service";

/** Buyer companies (staff) and a company's own profile + users (buyer administrator). */
@Module({
  controllers: [StaffBuyerOrganisationsController, BuyerCompanyController, BuyerUsersController],
  providers: [BuyerAdminService],
})
export class BuyerAdminModule {}
