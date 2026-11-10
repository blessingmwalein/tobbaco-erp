The full list is in [`docs/research/unresolved-business-questions.md`](../research/unresolved-business-questions.md) (UQ-01 … UQ-28). Everything below is built configurable and marked **Unverified** in the UI. The ones that most affect the backend:

| ID | Question | Why it matters |
|---|---|---|
| UQ-05 | Grower-charge rates/basis, internal invoice and merchant-loan rules, gross-value formula and rounding | Deductions and net payout are money. Phase 1 posts illustrative fixed amounts only; nothing is calculated by an invented formula |
| UQ-04 | Local currency naming (ZWL vs ZWG vs RTGS) and how net payout splits between USD and local currency | Payment schedules and bank files |
| UQ-06 | What creates "Pending Approvals", who approves, what a sale reversal/adjustment does, pay-batch numbering | Approval workflow and financial reversal records |
| UQ-13 | Real TIMB file layouts, encryption and key store | The import adapter; Phase 1 uses a clearly separated development sample adapter |
| UQ-01 | Ticket barcode check-character algorithm | Barcode validation (digit-sum mod 10 fits all five documented tickets but is unverified) |
| UQ-03 | Who releases a sale and where | Dispatch cannot start until a sale is released |
| UQ-12 | Sales-sheet report source, bank details owner, CloudPay configuration, destination warehouses, shipment-file columns, which dispatch app | Payments and dispatch outputs |

**Also needed from the project owner:** screenshots of the two Dribbble reference shots (both pages returned empty content to automated fetching), so proportions and density can be calibrated against them.
