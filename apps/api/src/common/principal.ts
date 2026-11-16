import type { BuyerPermission, BuyerRoleId, PrincipalType } from "@tobacco/shared";

/** The authenticated caller, resolved by AuthGuard on every request (fresh from the database, never trusted from the token). */
export interface StaffPrincipal {
  type: "STAFF";
  id: string;
  name: string;
  email: string;
}

export interface BuyerPrincipal {
  type: "BUYER";
  id: string;
  name: string;
  email: string;
  organisationId: string;
  organisationCode: string;
  organisationName: string;
  roles: BuyerRoleId[];
  permissions: ReadonlySet<BuyerPermission>;
}

export type Principal = StaffPrincipal | BuyerPrincipal;

export interface AccessTokenClaims {
  sub: string;
  typ: PrincipalType;
  /** Buyer organisation id (BUYER tokens only). */
  org?: string;
}

/** Express request augmented by the global guard and the request-id middleware. */
export interface AppRequest {
  id: string;
  principal?: Principal;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}
