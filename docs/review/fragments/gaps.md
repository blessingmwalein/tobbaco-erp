| # | Gap | Impact | Plan |
|---|---|---|---|
| 1 | **Dribbble design fusion not yet applied.** Both reference shots are unreachable to automated tools (bot protection); the current look follows the brief's written direction. | **High for visual sign-off** | Owner saves the two shots into `docs/design/references/`; then `reference-analysis.md`, token/component deltas, re-captured screenshots and side-by-side comparisons before approval |
| 2 | No real authentication — a demo role picker stands in for JWT sign-in; permissions are enforced by the mock only | Expected in Phase 1 | Phase 2: JWT, permission guards on every endpoint |
| 3 | Scanner, scale and printer are **simulated** (keyboard-wedge field, simulated weigh events, print preview). Nothing claims hardware is connected | Expected | Adapter interfaces are defined; real devices after approval |
| 4 | Real TIMB files are encrypted; the importer reads documented **dev sample** files only | Expected (UQ-13) | Separate encrypted-file adapter in Phase 4 once layouts/keys are supplied |
| 5 | Deduction amounts are illustrative fixed values; no charge formula is applied | Expected (UQ-05) | Needs Ethical/TIMB rates and rules |
| 6 | CloudPay is a mock and never marks growers paid; payment confirmation is a recorded, audited entry | Deliberate (stricter than Manual 08) | Real adapter in Phase 9 with idempotency and verified callbacks |
| 7 | PDF export is browser print-to-PDF; CSV is generated client-side | Minor | Server-side generation and object storage in Phase 11 |
| 8 | Dark mode and localisation (Shona/Ndebele) not built; English only | Minor | Out of scope for Phase 1 |
| 9 | Responsive checks: tablet widths verified on key screens; phone widths work but floor workspaces are designed for desktop/tablet | Minor | Phone-specific floor flows only if the business asks |
| 10 | Data volume: seeded with ~50 growers and one live day; tables paginate client-side | Minor | Server-side pagination and indexes in Phase 2+ |
| 11 | Two documented status-bar states ("Laying", sale "Posted") and several menu items (TRVs, Hessians, Laying, Intelliscale, Pending Issues, E-Marketing CSV, TIMB Files/Webservices, buyer invoicing) are not modelled | Needs business input (UQ-02, UQ-11) | Add when documented |
| 12 | "Split this Sale" and some other documented buttons are present but only audit-simulated (behaviour undocumented) | Needs business input (UQ-11, UQ-28) | Define with e-Port/Ethical |
| 13 | The mock DB lives in one browser's localStorage — two tabs/users do not share state | Expected | The backend is the shared source of truth |
| 14 | Notifications are in-app only (no email/SMS) | Minor | Notification module in Phase 11 |
