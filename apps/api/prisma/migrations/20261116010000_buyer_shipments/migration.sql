CREATE TYPE "BuyerShipmentStatus" AS ENUM (
  'IN_TRANSIT',
  'ARRIVED',
  'RECEIVING',
  'RECONCILIATION_REQUIRED',
  'CONFIRMED',
  'STORAGE_IN_PROGRESS',
  'ALLOCATED',
  'CANCELLED'
);

CREATE TYPE "BuyerShipmentBaleStatus" AS ENUM ('EXPECTED', 'RECEIVED', 'ALLOCATED', 'MISSING');
CREATE TYPE "BuyerShipmentImportStatus" AS ENUM ('STAGED', 'COMPLETED', 'CANCELLED');
ALTER TYPE "PurchaseReceivingStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_DISPATCHED';
ALTER TYPE "PurchaseReceivingStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_RECEIVED';

CREATE TABLE "buyer_shipments" (
  "id" UUID NOT NULL,
  "buyerOrganisationId" UUID NOT NULL,
  "purchaseId" UUID NOT NULL,
  "reference" TEXT NOT NULL,
  "dispatchDate" DATE NOT NULL,
  "dispatchLocation" TEXT,
  "destinationWarehouseId" UUID NOT NULL,
  "expectedArrivalAt" TIMESTAMP(3),
  "truckRegistration" TEXT NOT NULL,
  "trailerRegistration" TEXT,
  "driverName" TEXT NOT NULL,
  "driverPhone" TEXT,
  "transporter" TEXT,
  "notes" TEXT,
  "status" "BuyerShipmentStatus" NOT NULL DEFAULT 'IN_TRANSIT',
  "expectedBales" INTEGER NOT NULL,
  "expectedMassKg" DECIMAL(12,1) NOT NULL,
  "arrivedAt" TIMESTAMP(3),
  "arrivedById" UUID,
  "actualTruckRegistration" TEXT,
  "arrivalNotes" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "allocatedAt" TIMESTAMP(3),
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "buyer_shipments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "buyer_shipment_bales" (
  "id" UUID NOT NULL,
  "buyerOrganisationId" UUID NOT NULL,
  "shipmentId" UUID NOT NULL,
  "baleId" UUID NOT NULL,
  "massKgAtDispatch" DECIMAL(10,1) NOT NULL,
  "status" "BuyerShipmentBaleStatus" NOT NULL DEFAULT 'EXPECTED',
  "receivedAt" TIMESTAMP(3),
  "allocatedAt" TIMESTAMP(3),
  CONSTRAINT "buyer_shipment_bales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "buyer_shipment_imports" (
  "id" UUID NOT NULL,
  "buyerOrganisationId" UUID NOT NULL,
  "reference" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "rows" JSONB NOT NULL,
  "recordCount" INTEGER NOT NULL,
  "validCount" INTEGER NOT NULL,
  "invalidCount" INTEGER NOT NULL,
  "status" "BuyerShipmentImportStatus" NOT NULL DEFAULT 'STAGED',
  "shipmentId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3),
  CONSTRAINT "buyer_shipment_imports_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "receiving_sessions" ADD COLUMN "shipmentId" UUID;

CREATE UNIQUE INDEX "buyer_shipments_buyerOrganisationId_reference_key" ON "buyer_shipments"("buyerOrganisationId", "reference");
CREATE INDEX "buyer_shipments_buyerOrganisationId_status_idx" ON "buyer_shipments"("buyerOrganisationId", "status");
CREATE INDEX "buyer_shipments_purchaseId_status_idx" ON "buyer_shipments"("purchaseId", "status");
CREATE UNIQUE INDEX "buyer_shipment_bales_shipmentId_baleId_key" ON "buyer_shipment_bales"("shipmentId", "baleId");
CREATE UNIQUE INDEX "buyer_shipment_bales_baleId_key" ON "buyer_shipment_bales"("baleId");
CREATE UNIQUE INDEX "buyer_shipment_imports_buyerOrganisationId_reference_key" ON "buyer_shipment_imports"("buyerOrganisationId", "reference");
CREATE INDEX "buyer_shipment_imports_buyerOrganisationId_status_idx" ON "buyer_shipment_imports"("buyerOrganisationId", "status");
CREATE INDEX "buyer_shipment_bales_buyerOrganisationId_status_idx" ON "buyer_shipment_bales"("buyerOrganisationId", "status");
CREATE INDEX "buyer_shipment_bales_shipmentId_status_idx" ON "buyer_shipment_bales"("shipmentId", "status");
CREATE INDEX "receiving_sessions_shipmentId_idx" ON "receiving_sessions"("shipmentId");

ALTER TABLE "buyer_shipments" ADD CONSTRAINT "buyer_shipments_buyerOrganisationId_fkey" FOREIGN KEY ("buyerOrganisationId") REFERENCES "buyer_organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "buyer_shipments" ADD CONSTRAINT "buyer_shipments_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "buyer_shipments" ADD CONSTRAINT "buyer_shipments_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "buyer_shipment_bales" ADD CONSTRAINT "buyer_shipment_bales_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "buyer_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "buyer_shipment_bales" ADD CONSTRAINT "buyer_shipment_bales_baleId_fkey" FOREIGN KEY ("baleId") REFERENCES "bales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "buyer_shipment_imports" ADD CONSTRAINT "buyer_shipment_imports_buyerOrganisationId_fkey" FOREIGN KEY ("buyerOrganisationId") REFERENCES "buyer_organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "buyer_shipment_imports" ADD CONSTRAINT "buyer_shipment_imports_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "buyer_shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "receiving_sessions" ADD CONSTRAINT "receiving_sessions_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "buyer_shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
