/** Where each demo role lands after "signing in" (floor roles go straight to their workstation). */
export const LANDING_BY_ROLE: Record<string, string> = {
  "system-admin": "/admin/users",
  supervisor: "/dashboard",
  "timb-clerk": "/timb/imports",
  "receiving-clerk": "/floor/receiving",
  "receiving-supervisor": "/dashboard",
  "ticket-clerk": "/floor/tickets",
  "floor-summary-clerk": "/floor/floor-summary",
  "data-clerk": "/floor/data-capture",
  "data-processing-supervisor": "/sales",
  accounts: "/finance/payments",
  "dispatch-clerk": "/floor/dispatch",
  "dispatch-supervisor": "/dispatch",
  "demo-operator": "/dashboard",
};

export function landingFor(roleId: string | undefined): string {
  return (roleId && LANDING_BY_ROLE[roleId]) || "/dashboard";
}
