import { Inject, Injectable } from "@nestjs/common";
import { Prisma, type BuyerOrganisation, type BuyerUser } from "@prisma/client";
import type { BuyerOrganisationDto, BuyerRoleId, BuyerUserDto, Page } from "@tobacco/shared";
import type { CompanyProfileInput, CreateBuyerUserInput, CreateOrganisationInput, PageQuery, SetOrganisationStatusInput, UpdateBuyerUserInput } from "@tobacco/validation";
import { AppError } from "../../common/app-error";
import type { RequestMeta } from "../../common/decorators";
import { orderBy, pageArgs, toPage } from "../../common/pagination";
import type { Principal } from "../../common/principal";
import { PrismaService, type TenantTx } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthService } from "../auth/auth.service";

const toOrgDto = (o: BuyerOrganisation & { _count?: { users: number } }): BuyerOrganisationDto => ({
  id: o.id,
  code: o.code,
  name: o.name,
  registrationNo: o.registrationNo,
  address: o.address,
  contactPerson: o.contactPerson,
  phone: o.phone,
  email: o.email,
  status: o.status,
  createdAt: o.createdAt.toISOString(),
  ...(o._count ? { userCount: o._count.users } : {}),
});

const toUserDto = (u: BuyerUser): BuyerUserDto => ({
  id: u.id,
  name: u.name,
  email: u.email,
  roles: u.roles as BuyerRoleId[],
  active: u.active,
  activated: u.passwordHash !== null,
  lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  createdAt: u.createdAt.toISOString(),
});

const ADMIN: BuyerRoleId = "BUYER_ADMINISTRATOR";
const isAdminRole = (roles: readonly string[]) => roles.includes(ADMIN);

/**
 * Buyer organisations and their users.
 * Reference implementation of the module conventions: tenant-scoped client, one transaction per state change,
 * audit row in the SAME transaction, domain errors as AppError, DTOs (never raw Prisma rows) on the wire.
 */
@Injectable()
export class BuyerAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  // ── organisations (ERP staff) ──────────────────────────────────────────────
  async listOrganisations(q: PageQuery): Promise<Page<BuyerOrganisationDto>> {
    const where: Prisma.BuyerOrganisationWhereInput = q.search
      ? { OR: [{ name: { contains: q.search, mode: "insensitive" } }, { code: { contains: q.search, mode: "insensitive" } }] }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.buyerOrganisation.findMany({
        where,
        orderBy: orderBy(q, ["name", "code", "createdAt"] as const, "name"),
        ...pageArgs(q),
        include: { _count: { select: { users: true } } },
      }),
      this.prisma.buyerOrganisation.count({ where }),
    ]);
    return toPage(rows.map(toOrgDto), total, q);
  }

  async getOrganisation(id: string): Promise<BuyerOrganisationDto> {
    const org = await this.prisma.buyerOrganisation.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!org) throw AppError.notFound("Buyer organisation");
    return toOrgDto(org);
  }

  async createOrganisation(staff: Principal, input: CreateOrganisationInput, meta: RequestMeta): Promise<BuyerOrganisationDto> {
    const { admin, ...profile } = input;
    const created = await this.prisma
      .$transaction(async (tx) => {
        const org = await tx.buyerOrganisation.create({ data: profile });
        const user = await tx.buyerUser.create({ data: { buyerOrganisationId: org.id, name: admin.name, email: admin.email, roles: [ADMIN] } });
        await this.audit.record(tx, staff, { action: "buyer.organisation.created", entityType: "BuyerOrganisation", entityId: org.id, entityRef: org.code, next: { ...profile, admin: admin.email }, organisationId: org.id }, meta);
        return { org, user };
      })
      .catch(duplicate("That buyer code or administrator email is already registered"));
    await this.auth.sendActivation({ id: created.user.id, email: created.user.email, name: created.user.name, organisationName: created.org.name });
    return toOrgDto(created.org);
  }

  async updateOrganisation(actor: Principal, orgId: string, input: CompanyProfileInput, meta: RequestMeta): Promise<BuyerOrganisationDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const before = await tx.buyerOrganisation.findUnique({ where: { id: orgId } });
      if (!before) throw AppError.notFound("Buyer organisation");
      const after = await tx.buyerOrganisation.update({ where: { id: orgId }, data: input });
      await this.audit.record(tx, actor, { action: "buyer.organisation.updated", entityType: "BuyerOrganisation", entityId: orgId, entityRef: before.code, previous: pickProfile(before), next: pickProfile(after), organisationId: orgId }, meta);
      return after;
    });
    return toOrgDto(updated);
  }

  async setOrganisationStatus(staff: Principal, orgId: string, input: SetOrganisationStatusInput, meta: RequestMeta): Promise<BuyerOrganisationDto> {
    if (input.status === "INACTIVE" && !input.reason) throw AppError.unprocessable("REASON_REQUIRED", "Give a reason for deactivating a buyer company");
    const updated = await this.prisma.$transaction(async (tx) => {
      const before = await tx.buyerOrganisation.findUnique({ where: { id: orgId } });
      if (!before) throw AppError.notFound("Buyer organisation");
      const after = await tx.buyerOrganisation.update({ where: { id: orgId }, data: { status: input.status } });
      await this.audit.record(tx, staff, { action: `buyer.organisation.${input.status === "ACTIVE" ? "activated" : "deactivated"}`, entityType: "BuyerOrganisation", entityId: orgId, entityRef: before.code, previous: { status: before.status }, next: { status: after.status }, reason: input.reason ?? null, organisationId: orgId }, meta);
      return after;
    });
    if (input.status === "INACTIVE") {
      // The principal is re-checked on every request, so access ends at once; revoking refresh tokens also stops silent renewals.
      const users = await this.prisma.buyerUser.findMany({ where: { buyerOrganisationId: orgId }, select: { id: true } });
      await Promise.all(users.map((u) => this.auth.revokeAllSessions("BUYER", u.id)));
    }
    return toOrgDto(updated);
  }

  // ── users (buyer administrator, or ERP staff on behalf of a company) ───────
  async listUsers(orgId: string, q: PageQuery): Promise<Page<BuyerUserDto>> {
    const db = this.prisma.forOrganisation(orgId);
    const where: Prisma.BuyerUserWhereInput = q.search
      ? { OR: [{ name: { contains: q.search, mode: "insensitive" } }, { email: { contains: q.search, mode: "insensitive" } }] }
      : {};
    const [rows, total] = await Promise.all([
      db.buyerUser.findMany({ where, orderBy: orderBy(q, ["name", "email", "createdAt", "lastLoginAt"] as const, "name"), ...pageArgs(q) }),
      db.buyerUser.count({ where }),
    ]);
    return toPage(rows.map(toUserDto), total, q);
  }

  async createUser(actor: Principal, orgId: string, input: CreateBuyerUserInput, meta: RequestMeta): Promise<BuyerUserDto> {
    const { user, orgName } = await this.prisma
      .tenantTransaction(orgId, async (tx) => {
        const org = await tx.$queryRaw<Array<{ name: string; status: string }>>`SELECT name, status::text FROM buyer_organisations WHERE id = ${orgId}::uuid`;
        if (!org[0]) throw AppError.notFound("Buyer organisation");
        if (org[0].status !== "ACTIVE") throw AppError.conflict("ORGANISATION_INACTIVE", "This company is deactivated");
        const created = await tx.buyerUser.create({ data: { buyerOrganisationId: orgId, name: input.name, email: input.email, roles: input.roles } });
        await this.audit.record(tx, actor, { action: "buyer.user.created", entityType: "BuyerUser", entityId: created.id, entityRef: created.email, next: { name: created.name, email: created.email, roles: created.roles }, organisationId: orgId }, meta);
        return { user: created, orgName: org[0].name };
      })
      .catch(duplicate("That email address is already in use"));
    await this.auth.sendActivation({ id: user.id, email: user.email, name: user.name, organisationName: orgName });
    return toUserDto(user);
  }

  async updateUser(actor: Principal, orgId: string, userId: string, input: UpdateBuyerUserInput, meta: RequestMeta): Promise<BuyerUserDto> {
    const { updated, sessionsEnd } = await this.prisma.tenantTransaction(orgId, async (tx) => {
      // Serialise administrator changes within one company so two admins cannot remove each other concurrently.
      await tx.$queryRaw`SELECT id FROM buyer_organisations WHERE id = ${orgId}::uuid FOR UPDATE`;
      const before = await tx.buyerUser.findUnique({ where: { id: userId } });
      if (!before) throw AppError.notFound("User");

      const nextRoles = input.roles ?? (before.roles as BuyerRoleId[]);
      const nextActive = input.active ?? before.active;
      const staysAdmin = nextActive && isAdminRole(nextRoles);
      const wasAdmin = before.active && isAdminRole(before.roles);

      if (actor.type === "BUYER" && actor.id === userId && (!nextActive || (isAdminRole(before.roles) && !isAdminRole(nextRoles)))) {
        throw AppError.conflict("CANNOT_MODIFY_SELF", "You cannot deactivate yourself or remove your own administrator role");
      }
      if (wasAdmin && !staysAdmin) await this.assertAnotherAdmin(tx, userId);

      const after = await tx.buyerUser.update({ where: { id: userId }, data: { name: input.name, roles: input.roles, active: input.active } });
      const action = input.active === false && before.active ? "buyer.user.deactivated" : input.active === true && !before.active ? "buyer.user.reactivated" : "buyer.user.updated";
      await this.audit.record(tx, actor, { action, entityType: "BuyerUser", entityId: userId, entityRef: before.email, previous: pickUser(before), next: pickUser(after), organisationId: orgId }, meta);
      return { updated: after, sessionsEnd: (input.active === false && before.active) || input.roles !== undefined };
    });
    if (sessionsEnd) await this.auth.revokeAllSessions("BUYER", userId); // role/active changes take effect on the next sign-in too
    return toUserDto(updated);
  }

  async resendActivation(actor: Principal, orgId: string, userId: string, meta: RequestMeta): Promise<void> {
    const db = this.prisma.forOrganisation(orgId);
    const user = await db.buyerUser.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound("User");
    if (user.passwordHash) throw AppError.conflict("ALREADY_ACTIVATED", "This user has already activated their account");
    if (!user.active) throw AppError.conflict("USER_INACTIVE", "Reactivate the user before re-sending the invitation");
    const org = await this.prisma.buyerOrganisation.findUniqueOrThrow({ where: { id: orgId } });
    await this.auth.sendActivation({ id: user.id, email: user.email, name: user.name, organisationName: org.name });
    await this.audit.record(undefined, actor, { action: "buyer.user.invitation_resent", entityType: "BuyerUser", entityId: userId, entityRef: user.email, organisationId: orgId }, meta);
  }

  private async assertAnotherAdmin(tx: TenantTx, excludingUserId: string): Promise<void> {
    const others = await tx.buyerUser.count({ where: { active: true, roles: { has: ADMIN }, id: { not: excludingUserId } } });
    if (others === 0) throw AppError.conflict("LAST_ADMINISTRATOR", "Every company needs at least one active Buyer Administrator");
  }
}

const pickProfile = (o: BuyerOrganisation) => ({ name: o.name, registrationNo: o.registrationNo, address: o.address, contactPerson: o.contactPerson, phone: o.phone, email: o.email });
const pickUser = (u: BuyerUser) => ({ name: u.name, roles: u.roles, active: u.active });

/** Unique-constraint violations become a friendly 409 (the global filter would also map them, with a generic message). */
function duplicate(message: string) {
  return (e: unknown): never => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw AppError.conflict("DUPLICATE", message);
    throw e;
  };
}
