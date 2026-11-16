import { ALL_BUYER_PERMISSIONS, type BuyerPermission } from "./permissions";

/**
 * The five buyer-organisation roles from the brief (§2). A user holds one or more roles; effective permissions are the
 * union. Roles are fixed in code for now (the buyer administrator assigns them); a custom-role editor can follow.
 */
export const BUYER_ROLE_IDS = ["BUYER_ADMINISTRATOR", "WAREHOUSE_MANAGER", "OPERATIONS_OFFICER", "FINANCE_OFFICER", "VIEWER"] as const;
export type BuyerRoleId = (typeof BUYER_ROLE_IDS)[number];

export interface BuyerRoleDef {
  id: BuyerRoleId;
  name: string;
  description: string;
  permissions: BuyerPermission[];
}

const p = (...x: BuyerPermission[]): BuyerPermission[] => x;

export const BUYER_ROLES: BuyerRoleDef[] = [
  {
    id: "BUYER_ADMINISTRATOR",
    name: "Buyer Administrator",
    description: "Full access to company purchases, inventory, users and operations.",
    permissions: [...ALL_BUYER_PERMISSIONS],
  },
  {
    id: "WAREHOUSE_MANAGER",
    name: "Warehouse Manager",
    description: "Receive bales, scan, manage warehouse locations and transfers.",
    permissions: p(
      "buyer.dashboard.view",
      "buyer.purchases.view",
      "buyer.flowdisk.import", // assumption: the person who receives also loads the manifest (brief is silent)
      "buyer.receiving.view",
      "buyer.receiving.scan",
      "buyer.receiving.exceptions",
      "buyer.warehouse.view",
      "buyer.warehouse.manage",
      "buyer.warehouse.move",
      "buyer.processing.view",
      "buyer.traceability.view",
      "buyer.reports.view",
      "buyer.reports.export",
    ),
  },
  {
    id: "OPERATIONS_OFFICER",
    name: "Operations Officer",
    description: "Dispatch bales to processing companies and manage returns.",
    permissions: p(
      "buyer.dashboard.view",
      "buyer.purchases.view",
      "buyer.receiving.view",
      "buyer.warehouse.view",
      "buyer.warehouse.move",
      "buyer.processing.view",
      "buyer.processing.companies",
      "buyer.dispatch.create",
      "buyer.returns.receive",
      "buyer.traceability.view",
      "buyer.reports.view",
      "buyer.reports.export",
    ),
  },
  {
    id: "FINANCE_OFFICER",
    name: "Finance Officer",
    description: "View purchases, invoices and financial summaries.",
    permissions: p(
      "buyer.dashboard.view",
      "buyer.purchases.view",
      "buyer.invoices.view",
      "buyer.flowdisk.import", // assumption: finance loads the Flow Disk and invoice (brief is silent)
      "buyer.receiving.view",
      "buyer.traceability.view",
      "buyer.reports.view",
      "buyer.reports.export",
    ),
  },
  {
    id: "VIEWER",
    name: "Viewer",
    description: "Read-only access to permitted information.",
    permissions: p(
      "buyer.dashboard.view",
      "buyer.purchases.view",
      "buyer.receiving.view",
      "buyer.warehouse.view",
      "buyer.processing.view",
      "buyer.traceability.view",
      "buyer.reports.view",
    ),
  },
];

export const BUYER_ROLE_BY_ID: Record<BuyerRoleId, BuyerRoleDef> = Object.fromEntries(
  BUYER_ROLES.map((r) => [r.id, r]),
) as Record<BuyerRoleId, BuyerRoleDef>;

export function buyerPermissionsFor(roleIds: readonly string[]): Set<BuyerPermission> {
  const set = new Set<BuyerPermission>();
  for (const id of roleIds) {
    const role = BUYER_ROLE_BY_ID[id as BuyerRoleId];
    if (role) for (const perm of role.permissions) set.add(perm);
  }
  return set;
}
