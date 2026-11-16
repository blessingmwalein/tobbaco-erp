import type { BuyerRoleId } from "../roles";

export type BuyerOrgStatusDto = "ACTIVE" | "INACTIVE";

/** A buyer company (tenant). Also the "company profile" a buyer administrator edits. */
export interface BuyerOrganisationDto {
  id: string;
  /** Buyer code as used on the auction floor, e.g. "MZ". */
  code: string;
  name: string;
  registrationNo: string | null;
  address: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  status: BuyerOrgStatusDto;
  createdAt: string;
  userCount?: number;
}

export interface BuyerUserDto {
  id: string;
  name: string;
  email: string;
  roles: BuyerRoleId[];
  active: boolean;
  /** false until the user has chosen a password from the activation link. */
  activated: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}
