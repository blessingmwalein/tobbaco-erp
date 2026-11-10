# ADR-0004 — Money, weights and currency configuration

- **Status:** Accepted (currency naming and rounding pending UQ-04, UQ-05)
- **Date:** 2026-11-09

## Context
The system handles sale values, deductions, payouts and exchange rates in USD and a local currency. The manuals show: price in **US cents per kg (whole number)**, exchange rate with 8 decimals (26.68450000), amounts with 8 decimals (e.g. `193.70000000`), USD and "ZWL" schedules in Manual 08, "ZWG Payment Ref" on the sale form and "RTGS Value" in lists. Formulas for gross, deductions and conversion are only partly documented.

## Decision
- All money and weight arithmetic uses **decimal** types (Phase 1: a decimal library, e.g. decimal.js; Phase 2: PostgreSQL `numeric` + Prisma `Decimal`). Never JS floating point.
- Store amounts with currency code; store prices as integer **US cents/kg** exactly as captured; mass in kg (numeric).
- Currencies and the default local-currency code are **configuration** (default `USD` + `ZWL`, per Manual 08 and the brief), not enums in code, until UQ-04 is answered.
- Exchange rate is stored per Start of Day with the precision shown (8 d.p.); conversion method displayed as "unverified".
- Deduction amounts and rates are configurable data (Grower Charges, stop orders); the system never encodes an invented formula. Demo fixtures contain fixed, demo-labelled amounts that reconcile to the documented totals.
- Rounding rule is an explicit setting (default flagged "unverified").
- Posted financial rows are immutable; corrections via reversal/adjustment rows.

## Consequences
+ No floating-point drift; formulas can be adopted once confirmed.
− Extra UI affordance ("unverified" markers) until finance confirms rules.

Sources: Manuals 06, 07, 08; brief Parts 8, 14.
