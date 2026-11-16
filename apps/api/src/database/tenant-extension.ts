import { Prisma } from "@prisma/client";

/**
 * Tenant isolation — defence in depth.
 *
 * Every buyer-owned table carries `buyerOrganisationId`. Services receive a tenant-scoped client
 * (`prisma.forOrganisation(orgId)`) which AUTOMATICALLY:
 *   - ANDs `buyerOrganisationId = orgId` into every read / update / delete filter, and
 *   - stamps `buyerOrganisationId` on every create (and REJECTS a create that names a different organisation).
 * So even a query that forgets its own tenant filter cannot reach another buyer's rows.
 *
 * Models without the column (child rows reached only through a scoped parent) are intentionally not listed.
 */
export const TENANT_MODELS = [
  "BuyerUser",
  "Document",
  "FlowDiskImport",
  "BuyerInvoice",
  "Purchase",
  "Bale",
  "ReceivingSession",
  "ReceivingScan",
  "ReceivingException",
  "Warehouse",
  "Bay",
  "WarehouseRow",
  "BaleMovement",
  "BaleEvent",
  "ProcessingCompany",
  "Dispatch",
  "DispatchBale",
  "ProcessingReturn",
  "ReturnBale",
  "BaleLineage",
  "ReferenceSequence",
] as const;

const TENANT_SET = new Set<string>(TENANT_MODELS);

/** BuyerUser/Document use a differently named FK in the schema? No — all use buyerOrganisationId. */
const FIELD = "buyerOrganisationId";

/** Operations whose `where` is free-form: the tenant filter is ANDed in. */
const FILTERED_OPS = new Set(["findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy", "updateMany", "deleteMany"]);

/**
 * Operations keyed by a unique `where`: Prisma rejects an AND wrapper there, so the tenant column is added NEXT TO the
 * unique key (extendedWhereUnique). A row of another organisation then simply is not found (P2025 / null).
 */
const UNIQUE_OPS = new Set(["findUnique", "findUniqueOrThrow", "update", "delete"]);

export class TenantViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantViolationError";
  }
}

type AnyArgs = Record<string, unknown> | undefined;

/** Pure function (unit-tested without a database): rewrite query args so they are confined to one organisation. */
export function scopeArgs(model: string, operation: string, args: AnyArgs, organisationId: string): AnyArgs {
  if (!TENANT_SET.has(model)) return args;
  const next: Record<string, unknown> = { ...(args ?? {}) };

  if (FILTERED_OPS.has(operation)) {
    const where = (next.where as Record<string, unknown> | undefined) ?? {};
    next.where = { AND: [where, { [FIELD]: organisationId }] };
  }

  if (UNIQUE_OPS.has(operation)) {
    const where = (next.where as Record<string, unknown> | undefined) ?? {};
    if (FIELD in where && where[FIELD] !== undefined && where[FIELD] !== organisationId) {
      throw new TenantViolationError(`Attempt to address a row of another organisation (${String(where[FIELD])})`);
    }
    next.where = { ...where, [FIELD]: organisationId };
  }

  if (operation === "create") {
    next.data = stampData(next.data as Record<string, unknown>, organisationId);
  }
  if (operation === "createMany" || operation === "createManyAndReturn") {
    const data = next.data;
    next.data = Array.isArray(data)
      ? data.map((d) => stampData(d as Record<string, unknown>, organisationId))
      : stampData(data as Record<string, unknown>, organisationId);
  }
  if (operation === "upsert") {
    const where = (next.where as Record<string, unknown> | undefined) ?? {};
    if (FIELD in where && where[FIELD] !== undefined && where[FIELD] !== organisationId) {
      throw new TenantViolationError(`Attempt to address a row of another organisation (${String(where[FIELD])})`);
    }
    next.where = { ...where, [FIELD]: organisationId };
    next.create = stampData(next.create as Record<string, unknown>, organisationId);
  }
  return next;
}

function stampData(data: Record<string, unknown> | undefined, organisationId: string): Record<string, unknown> {
  const d = { ...(data ?? {}) };
  if (FIELD in d && d[FIELD] !== undefined && d[FIELD] !== organisationId) {
    throw new TenantViolationError(`Attempt to write a row for another organisation (${String(d[FIELD])})`);
  }
  d[FIELD] = organisationId;
  return d;
}

/** Prisma client extension that confines a client to one buyer organisation. */
export function tenantExtension(organisationId: string) {
  return Prisma.defineExtension({
    name: `tenant:${organisationId}`,
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          return query(scopeArgs(model, operation, args as AnyArgs, organisationId) as typeof args);
        },
      },
    },
  });
}
