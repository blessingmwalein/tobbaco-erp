import { Inject, Injectable } from "@nestjs/common";
import { buyerPermissionsFor, type BuyerRoleId } from "@tobacco/shared";
import type { BuyerPrincipal, Principal, StaffPrincipal } from "../../common/principal";
import { PrismaService } from "../../database/prisma.service";

/** Loads the caller FRESH from the database: deactivated users/organisations and role changes take effect immediately. */
@Injectable()
export class PrincipalService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async loadBuyer(userId: string): Promise<BuyerPrincipal | null> {
    const u = await this.prisma.buyerUser.findUnique({ where: { id: userId }, include: { organisation: true } });
    if (!u || !u.active || u.organisation.status !== "ACTIVE") return null;
    const roles = u.roles as BuyerRoleId[];
    return {
      type: "BUYER",
      id: u.id,
      name: u.name,
      email: u.email,
      organisationId: u.buyerOrganisationId,
      organisationCode: u.organisation.code,
      organisationName: u.organisation.name,
      roles,
      permissions: buyerPermissionsFor(roles),
    };
  }

  async loadStaff(userId: string): Promise<StaffPrincipal | null> {
    const u = await this.prisma.staffUser.findUnique({ where: { id: userId } });
    if (!u || !u.active) return null;
    return { type: "STAFF", id: u.id, name: u.name, email: u.email };
  }

  load(type: "STAFF" | "BUYER", id: string): Promise<Principal | null> {
    return type === "BUYER" ? this.loadBuyer(id) : this.loadStaff(id);
  }
}

/** What the web client receives about the signed-in user. */
export interface PublicPrincipal {
  type: "STAFF" | "BUYER";
  id: string;
  name: string;
  email: string;
  organisation?: { id: string; code: string; name: string };
  roles?: string[];
  permissions?: string[];
}

export function toPublicPrincipal(p: Principal): PublicPrincipal {
  if (p.type === "STAFF") return { type: "STAFF", id: p.id, name: p.name, email: p.email };
  return {
    type: "BUYER",
    id: p.id,
    name: p.name,
    email: p.email,
    organisation: { id: p.organisationId, code: p.organisationCode, name: p.organisationName },
    roles: [...p.roles],
    permissions: [...p.permissions].sort(),
  };
}
