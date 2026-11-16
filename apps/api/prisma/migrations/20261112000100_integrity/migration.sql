-- Integrity rules that the Prisma schema language cannot express.
-- These are the database-level backstop for the rules the API also enforces in code (defence in depth).

-- ── One live receipt per bale ───────────────────────────────────────────────
-- A bale cannot be received twice without an authorised correction (which voids the earlier receipt).
CREATE UNIQUE INDEX "receiving_scans_one_receipt_per_bale"
  ON "receiving_scans" ("baleId")
  WHERE "result" = 'RECEIVED' AND "voidedAt" IS NULL;

-- ── A bale can be outstanding on at most one dispatch ───────────────────────
CREATE UNIQUE INDEX "dispatch_bales_one_open_per_bale"
  ON "dispatch_bales" ("baleId")
  WHERE "status" = 'OUTSTANDING';

-- ── One live import per file per buyer ──────────────────────────────────────
-- A repeat upload may still be RECORDED (status REJECTED_DUPLICATE) but cannot become a second live import.
CREATE UNIQUE INDEX "flow_disk_imports_one_live_per_file"
  ON "flow_disk_imports" ("buyerOrganisationId", "fileSha256")
  WHERE "status" IN ('STAGED', 'COMPLETED');

-- ── Bale sanity ─────────────────────────────────────────────────────────────
ALTER TABLE "bales" ADD CONSTRAINT "bales_barcode_length" CHECK (char_length("barcode") = 10);
ALTER TABLE "bales" ADD CONSTRAINT "bales_mass_positive" CHECK ("massKg" > 0);
ALTER TABLE "bales" ADD CONSTRAINT "bales_value_not_negative" CHECK ("usdValue" >= 0);
ALTER TABLE "bales" ADD CONSTRAINT "bales_price_not_negative" CHECK ("uscPerKg" >= 0);

-- A bale has at most ONE active physical location, expressed top-down (row ⇒ bay ⇒ warehouse).
ALTER TABLE "bales" ADD CONSTRAINT "bales_location_hierarchy" CHECK (
  ("currentRowId" IS NULL OR "currentBayId" IS NOT NULL)
  AND ("currentBayId" IS NULL OR "currentWarehouseId" IS NOT NULL)
);

-- Dispatched, expected and re-identified (superseded) bales are not in any warehouse.
ALTER TABLE "bales" ADD CONSTRAINT "bales_no_location_unless_stored" CHECK (
  "status" IN ('IN_STOCK', 'RETURNED', 'EXCEPTION') OR "currentWarehouseId" IS NULL
);

ALTER TABLE "dispatch_bales" ADD CONSTRAINT "dispatch_bales_mass_positive" CHECK ("massKgAtDispatch" > 0);
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_has_bales" CHECK ("totalBales" > 0);

-- ── Immutable ledgers ───────────────────────────────────────────────────────
-- Stock movements, the bale timeline and the audit log are append-only: history is corrected with NEW rows, never edited.
CREATE OR REPLACE FUNCTION forbid_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table "%" is an immutable ledger: % is not allowed (add a correcting row instead)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "bale_events_immutable"
  BEFORE UPDATE OR DELETE ON "bale_events"
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();

CREATE TRIGGER "bale_movements_immutable"
  BEFORE UPDATE OR DELETE ON "bale_movements"
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();

CREATE TRIGGER "audit_logs_immutable"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();
