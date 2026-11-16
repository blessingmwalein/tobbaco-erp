import type { BuyerPermission } from "../permissions";
import type { BuyerRoleId } from "../roles";

export interface OrganisationRefDto {
  id: string;
  code: string;
  name: string;
}

/** The signed-in caller as the API exposes it (GET /auth/me, and inside a Session). */
export interface PublicPrincipalDto {
  type: "STAFF" | "BUYER";
  id: string;
  name: string;
  email: string;
  organisation?: OrganisationRefDto;
  roles?: BuyerRoleId[];
  permissions?: BuyerPermission[];
}

export interface SessionDto {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  principal: PublicPrincipalDto;
}
