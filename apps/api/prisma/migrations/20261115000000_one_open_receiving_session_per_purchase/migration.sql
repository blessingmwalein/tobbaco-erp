CREATE UNIQUE INDEX "receiving_sessions_one_open_per_purchase"
ON "receiving_sessions" ("buyerOrganisationId", "purchaseId")
WHERE "status" = 'OPEN';
