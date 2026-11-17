CREATE TYPE "PurchaseReconciliationStatus" AS ENUM ('AWAITING_SHIPMENTS', 'IN_PROGRESS', 'CLOSED');

CREATE TABLE "purchase_reconciliations" (
  "id" UUID NOT NULL,
  "buyerOrganisationId" UUID NOT NULL,
  "purchaseId" UUID NOT NULL,
  "status" "PurchaseReconciliationStatus" NOT NULL DEFAULT 'AWAITING_SHIPMENTS',
  "snapshot" JSONB,
  "closedById" UUID,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_reconciliations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "purchase_reconciliations_purchaseId_key" ON "purchase_reconciliations"("purchaseId");
CREATE INDEX "purchase_reconciliations_buyerOrganisationId_status_idx" ON "purchase_reconciliations"("buyerOrganisationId", "status");

ALTER TABLE "purchase_reconciliations" ADD CONSTRAINT "purchase_reconciliations_buyerOrganisationId_fkey" FOREIGN KEY ("buyerOrganisationId") REFERENCES "buyer_organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_reconciliations" ADD CONSTRAINT "purchase_reconciliations_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "purchase_reconciliations" (
  "id", "buyerOrganisationId", "purchaseId", "status", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  p."buyerOrganisationId",
  p."id",
  CASE WHEN EXISTS (SELECT 1 FROM "buyer_shipments" s WHERE s."purchaseId" = p."id") THEN 'IN_PROGRESS'::"PurchaseReconciliationStatus" ELSE 'AWAITING_SHIPMENTS'::"PurchaseReconciliationStatus" END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "purchases" p;

DROP INDEX IF EXISTS "receiving_sessions_one_open_per_purchase";
CREATE UNIQUE INDEX "receiving_sessions_one_open_per_shipment"
ON "receiving_sessions" ("buyerOrganisationId", "shipmentId")
WHERE "status" = 'OPEN' AND "shipmentId" IS NOT NULL;
