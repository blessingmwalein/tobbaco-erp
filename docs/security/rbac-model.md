# RBAC Model

Permissions are enforced by the **backend**; hiding buttons in the UI is only a convenience. In Phase 1 the mock layer (`mockApi`) enforces the same model so the demo behaves correctly and the swap to the real API changes nothing for users.

## Concepts
| Concept | Description |
|---|---|
| Permission | Action-level key, e.g. `receiving.eject-bale`, `sales.balance`, `payments.confirm-payment`. Catalogue in `role-permission-matrix.md` |
| Role | Named set of permissions (12 default roles; custom roles allowed) |
| User ↔ roles | A user may hold several roles; effective permissions = union of role permissions ± per-user overrides |
| Permission override | Explicit grant or deny per user (deny wins), always audited |
| Selling-point restriction | A user is limited to listed selling points; every query and action is filtered/checked |
| Active/inactive | Inactive users cannot sign in or act; history retained |
| Configuration | The System Administrator edits roles/permissions/users through the UI — no code change |

## Enforcement (Phase 2+)
1. **Authentication:** JWT (short-lived access token + refresh strategy), stateless on Vercel; revocation list in DB if needed.
2. **Authorization guard:** every controller action declares required permission(s) via a decorator; a guard resolves the user's effective permissions (cached per request) and the selling-point scope.
3. **Service layer re-checks** state-transition prerequisites (state, ownership, segregation of duties) inside the transaction.
4. **Data-level scope:** repositories filter by selling point/organisation.
5. **Responses:** 401 unauthenticated, 403 lacking permission (with the missing permission key in dev, not in prod), 409 invalid state transition.

## Segregation of duties
- Approver ≠ requester unless an explicit configured rule allows it (brief).
- Optional (default off, unverified): batch price entered by a different user than the captured price (Manual 06 "second clerk").
- Payment confirmation requires `payments.confirm-payment` (Accounts); CSV generation alone never changes payment state.
- Privileged corrections (eject bale, reverse printing status, sale reversal, release, dispatch cancel/reset) require a reason and are audited; some may require approval (configurable; triggers undocumented — UQ-06).

## Phase 1 UI behaviour
- Navigation is role-aware (hidden entries); controls the role lacks are **disabled with a tooltip "Requires permission X"**; deep links show a "no permission" state.
- A **demo role switcher** in the user menu changes the active demo user/role to show the matrix in action; the switch is itself labelled demo-only.

## Default roles
System Administrator · Supervisor · TIMB Clerk · Receiving Clerk · Receiving Supervisor · Ticket Clerk · Floor Summary Clerk · Data Clerk · Data Processing Supervisor · Accounts · Dispatch Clerk · Dispatch Supervisor — grants in `role-permission-matrix.md`.

## Security basics to carry into Phase 2
Password hashing (argon2/bcrypt), lockout/rate limiting on login, secure cookie or header token handling, CSRF considerations if cookies are used, input validation on every endpoint (Zod/class-validator), no secrets in source, least-privilege DB role, audit of auth events.

Sources: brief Part 4; Manuals 01–09 (role tables).
