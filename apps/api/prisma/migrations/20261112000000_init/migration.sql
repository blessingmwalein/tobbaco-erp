-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PrincipalType" AS ENUM ('STAFF', 'BUYER');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "BuyerOrgStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BuyerRole" AS ENUM ('BUYER_ADMINISTRATOR', 'WAREHOUSE_MANAGER', 'OPERATIONS_OFFICER', 'FINANCE_OFFICER', 'VIEWER');

-- CreateEnum
CREATE TYPE "OneTimeTokenKind" AS ENUM ('PASSWORD_RESET', 'ACCOUNT_ACTIVATION');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('FLOW_DISK', 'INVOICE_PDF', 'DISPATCH_DOCUMENT', 'RECONCILIATION_REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "FlowDiskImportStatus" AS ENUM ('STAGED', 'COMPLETED', 'REJECTED_DUPLICATE', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportIssueSeverity" AS ENUM ('ERROR', 'WARNING');

-- CreateEnum
CREATE TYPE "ImportIssueKind" AS ENUM ('INVALID_RECORD', 'DUPLICATE_BARCODE', 'MISSING_BARCODE', 'INVALID_BARCODE_CHECK', 'MISSING_GROWER', 'MISSING_LOT', 'INVALID_MASS', 'INVALID_VALUE', 'VALUE_MISMATCH', 'EXISTING_BALE');

-- CreateEnum
CREATE TYPE "BaleStatus" AS ENUM ('EXPECTED', 'IN_STOCK', 'DISPATCHED', 'RETURNED', 'EXCEPTION', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PurchaseReceivingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PARTIAL', 'COMPLETE');

-- CreateEnum
CREATE TYPE "ReceivingSessionStatus" AS ENUM ('OPEN', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScanResult" AS ENUM ('RECEIVED', 'UNEXPECTED', 'DUPLICATE_SCAN', 'WRONG_BUYER', 'WRONG_PURCHASE', 'INVALID_BARCODE', 'EXCEPTION');

-- CreateEnum
CREATE TYPE "ExceptionStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "WarehouseKind" AS ENUM ('STANDARD', 'PROCESSING');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('STORE', 'MOVE', 'TRANSFER', 'DISPATCH_OUT', 'RETURN_IN');

-- CreateEnum
CREATE TYPE "MovementRefType" AS ENUM ('RECEIVING_SESSION', 'DISPATCH', 'RETURN', 'MANUAL');

-- CreateEnum
CREATE TYPE "BaleEventType" AS ENUM ('PURCHASED', 'IMPORTED', 'RECEIVED', 'STORED', 'MOVED', 'DISPATCHED', 'RETURNED', 'RE_IDENTIFIED', 'EXCEPTION_FLAGGED', 'EXCEPTION_RESOLVED', 'CORRECTION');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('DISPATCHED', 'PARTIALLY_RETURNED', 'RETURNED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DispatchBaleStatus" AS ENUM ('OUTSTANDING', 'RETURNED', 'REPLACED', 'MISSING');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('OPEN', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnOutcome" AS ENUM ('RETURNED', 'DAMAGED', 'REGRADED', 'REIDENTIFIED', 'UNEXPECTED', 'MISSING');

-- CreateTable
CREATE TABLE "staff_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'ADMIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_organisations" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNo" TEXT,
    "address" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "status" "BuyerOrgStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyer_organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_users" (
    "id" UUID NOT NULL,
    "buyerOrganisationId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "roles" "BuyerRole"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyer_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "principalType" "PrincipalType" NOT NULL,
    "principalId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ip" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_time_tokens" (
    "id" UUID NOT NULL,
    "kind" "OneTimeTokenKind" NOT NULL,
    "principalType" "PrincipalType" NOT NULL,
    "principalId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_emails" (
    "id" UUID NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "driver" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_sequences" (
    "id" UUID NOT NULL,
    "buyerOrganisationId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "reference_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "buyerOrganisationId" UUID,
    "kind" "DocumentKind" NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdByType" "PrincipalType",
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_disk_imports" (
    "id" UUID NOT NULL,
    "buyerOrganisationId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "FlowDiskImportStatus" NOT NULL DEFAULT 'STAGED',
    "filename" TEXT NOT NULL,
    "parserId" TEXT NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "formatVerified" BOOLEAN NOT NULL DEFAULT false,
    "fileSha256" TEXT NOT NULL,
    "fileDocumentId" UUID,
    "invoiceDocumentId" UUID,
    "header" JSONB NOT NULL,
    "stagedRows" JSONB NOT NULL,
    "invoiceDraft" JSONB,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "validCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "expectedMassKg" DECIMAL(12,1) NOT NULL DEFAULT 0,
    "expectedUsdValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedById" UUID,
    "confirmedAt" TIMESTAMP(3),
    "invoiceId" UUID,
    "purchaseId" UUID,

    CONSTRAINT "flow_disk_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_row_issues" (
    "id" UUID NOT NULL,
    "importId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "kind" "ImportIssueKind" NOT NULL,
    "severity" "ImportIssueSeverity" NOT NULL DEFAULT 'ERROR',
    "field" TEXT,
    "message" TEXT NOT NULL,
    "raw" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "import_row_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_invoices" (
    "id" UUID NOT NULL,
    "buyerOrganisationId" UUID NOT NULL,
    "invoiceNumber" TEXT,
    "reference" TEXT NOT NULL,
    "company" TEXT,
    "floorName" TEXT NOT NULL,
    "buyerNameOnInvoice" TEXT NOT NULL,
    "saleDateFrom" DATE NOT NULL,
    "saleDateTo" DATE NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "exchangeRate" DECIMAL(14,6) NOT NULL,
    "preparedBy" TEXT,
    "totalBales" INTEGER NOT NULL,
    "totalMassKg" DECIMAL(12,1) NOT NULL,
    "avgUscPerKg" DECIMAL(8,2) NOT NULL,
    "totalUsdValue" DECIMAL(14,2) NOT NULL,
    "totalZigValue" DECIMAL(16,2),
    "splitUsdPercent" DECIMAL(5,2),
    "payableUsd" DECIMAL(14,2),
    "payableZig" DECIMAL(16,2),
    "documentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyer_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_charges" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountUsd" DECIMAL(14,2) NOT NULL,
    "amountZig" DECIMAL(16,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "invoice_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_grade_summaries" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "grade" TEXT NOT NULL,
    "bales" INTEGER NOT NULL,
    "massKg" DECIMAL(12,1) NOT NULL,
    "avgUsc" DECIMAL(8,2) NOT NULL,
    "usdValue" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "invoice_grade_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" UUID NOT NULL,
    "buyerOrganisationId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "floorName" TEXT NOT NULL,
    "saleDate" DATE NOT NULL,
    "totalBales" INTEGER NOT NULL,
    "totalMassKg" DECIMAL(12,1) NOT NULL,
    "totalUsdValue" DECIMAL(14,2) NOT NULL,
    "receivingStatus" "PurchaseReceivingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bales" (
    "id" UUID NOT NULL,
    "buyerOrganisationId" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "barcode" VARCHAR(10) NOT NULL,
    "season" INTEGER NOT NULL,
    "buyerGrade" TEXT NOT NULL,
    "timbGrade" TEXT,
    "growerNo" TEXT NOT NULL,
    "lotNo" TEXT NOT NULL,
    "massKg" DECIMAL(10,1) NOT NULL,
    "uscPerKg" DECIMAL(8,2) NOT NULL,
    "usdValue" DECIMAL(14,2) NOT NULL,
    "status" "BaleStatus" NOT NULL DEFAULT 'EXPECTED',
    "currentWarehouseId" UUID,
    "currentBayId" UUID,
    "currentRowId" UUID,
    "receivedAt" TIMESTAMP(3),
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receiving_sessions" (
    "id" UUID NOT NULL,
    "buyerOrganisationId" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "ReceivingSessionStatus" NOT NULL DEFAULT 'OPEN',
    "startedById" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedById" UUID,
    "confirmedAt" TIMESTAMP(3),
    "defaultWarehouseId" UUID,
    "defaultBayId" UUID,
    "defaultRowId" UUID,
    "notes" TEXT,
    "reconciliation" JSONB,
    "reportDocumentId" UUID,

    CONSTRAINT "receiving_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receiving_scans" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "buyerOrganisationId" UUID NOT NULL,
    "barcode" VARCHAR(32) NOT NULL,
    "result" "ScanResult" NOT NULL,
    "baleId" UUID,
    "massKg" DECIMAL(10,1),
    "warehouseId" UUID,
    "bayId" UUID,
    "rowId" UUID,
    "scannedById" UUID NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" UUID,
    "voidReason" TEXT,

    CONSTRAINT "receiving_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receiving_exceptions" (
    "id" UUID NOT NULL,
    "buyerOrganisationId" UUID NOT NULL,
    "sessionId" UUID,
    "scanId" UUID,
    "baleId" UUID,
    "barcode" VARCHAR(32) NOT NULL,
    "kind" "ScanResult" NOT NULL,
    "explanation" TEXT NOT NULL,
    "status" "ExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "raisedById" UUID NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedById" UUID,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,

    CONSTRAINT "receiving_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "buyerOrganisationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "WarehouseKind" NOT NULL DEFAULT 'STANDARD',
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bays" (
    "id" UUID NOT NULL,
    "buyerOrganisationId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_rows" (
    "id" UUID NOT NULL,
    "buyerOrganisationId" UUID NOT NULL,
    "bayId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "capacityBales" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "warehouse_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bale_movements" (
    "id" UUID NOT NULL,
    "buyerOrganisationId" UUID NOT NULL,
    "baleId" UUID NOT NULL,
    "type" "MovementType" NOT NULL,
    "fromWarehouseId" UUID,
    "fromBayId" UUID,
    "fromRowId" UUID,
    "toWarehouseId" UUID,
    "toBayId" UUID,
    "toRowId" UUID,
    "reason" TEXT NOT NULL,
    "performedById" UUID NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refType" "MovementRefType" NOT NULL DEFAULT 'MANUAL',
    "refId" UUID,
    "note" TEXT,

    CONSTRAINT "bale_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bale_events" (
    "id" UUID NOT NULL,
    "buyerOrganisationId" UUID NOT NULL,
    "baleId" UUID NOT NULL,
    "type" "BaleEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedById" UUID,
    "performedByName" TEXT,
    "fromLabel" TEXT,
    "toLabel" TEXT,
    "refType" TEXT,
    "refId" UUID,
    "refLabel" TEXT,
    "notes" TEXT,
    "payload" JSONB,

    CONSTRAINT "bale_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_companies" (
    "id" UUID NOT NULL,
    "buyerOrganisationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNo" TEXT,
    "address" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatches" (
    "id" UUID NOT NULL,
    "buyerOrganisationId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "processingCompanyId" UUID NOT NULL,
    "dispatchDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" "DispatchStatus" NOT NULL DEFAULT 'DISPATCHED',
    "totalBales" INTEGER NOT NULL,
    "totalMassKg" DECIMAL(12,1) NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentId" UUID,
    "closedAt" TIMESTAMP(3),
    "closedById" UUID,
    "closeExplanation" TEXT,

    CONSTRAINT "dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_bales" (
    "id" UUID NOT NULL,
    "buyerOrganisationId" UUID NOT NULL,
    "dispatchId" UUID NOT NULL,
    "baleId" UUID NOT NULL,
    "sourceWarehouseId" UUID,
    "sourceBayId" UUID,
    "sourceRowId" UUID,
    "massKgAtDispatch" DECIMAL(10,1) NOT NULL,
    "status" "DispatchBaleStatus" NOT NULL DEFAULT 'OUTSTANDING',

    CONSTRAINT "dispatch_bales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_returns" (
    "id" UUID NOT NULL,
    "buyerOrganisationId" UUID NOT NULL,
    "dispatchId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'OPEN',
    "startedById" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedById" UUID,
    "confirmedAt" TIMESTAMP(3),
    "notes" TEXT,
    "reconciliation" JSONB,
    "reportDocumentId" UUID,

    CONSTRAINT "processing_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_bales" (
    "id" UUID NOT NULL,
    "buyerOrganisationId" UUID NOT NULL,
    "returnId" UUID NOT NULL,
    "dispatchBaleId" UUID,
    "originalBaleId" UUID,
    "scannedBarcode" VARCHAR(32) NOT NULL,
    "newBaleId" UUID,
    "outcome" "ReturnOutcome" NOT NULL,
    "returnedMassKg" DECIMAL(10,1),
    "newBuyerGrade" TEXT,
    "newTimbGrade" TEXT,
    "condition" TEXT,
    "explanation" TEXT,
    "warehouseId" UUID,
    "bayId" UUID,
    "rowId" UUID,
    "scannedById" UUID NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_bales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bale_lineage" (
    "id" UUID NOT NULL,
    "buyerOrganisationId" UUID NOT NULL,
    "originalBaleId" UUID NOT NULL,
    "newBaleId" UUID NOT NULL,
    "originalBarcode" VARCHAR(10) NOT NULL,
    "newBarcode" VARCHAR(10) NOT NULL,
    "reason" TEXT NOT NULL,
    "returnId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bale_lineage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "principalType" "PrincipalType",
    "principalId" UUID,
    "principalName" TEXT,
    "buyerOrganisationId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "entityRef" TEXT,
    "previous" JSONB,
    "next" JSONB,
    "reason" TEXT,
    "ip" TEXT,
    "requestId" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_email_key" ON "staff_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_organisations_code_key" ON "buyer_organisations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_users_email_key" ON "buyer_users"("email");

-- CreateIndex
CREATE INDEX "buyer_users_buyerOrganisationId_idx" ON "buyer_users"("buyerOrganisationId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_principalType_principalId_idx" ON "refresh_tokens"("principalType", "principalId");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "one_time_tokens_tokenHash_key" ON "one_time_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "one_time_tokens_principalType_principalId_kind_idx" ON "one_time_tokens"("principalType", "principalId", "kind");

-- CreateIndex
CREATE INDEX "outbox_emails_toEmail_createdAt_idx" ON "outbox_emails"("toEmail", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reference_sequences_buyerOrganisationId_key_key" ON "reference_sequences"("buyerOrganisationId", "key");

-- CreateIndex
CREATE INDEX "documents_buyerOrganisationId_kind_idx" ON "documents"("buyerOrganisationId", "kind");

-- CreateIndex
CREATE INDEX "documents_sha256_idx" ON "documents"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "flow_disk_imports_invoiceId_key" ON "flow_disk_imports"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "flow_disk_imports_purchaseId_key" ON "flow_disk_imports"("purchaseId");

-- CreateIndex
CREATE INDEX "flow_disk_imports_buyerOrganisationId_status_createdAt_idx" ON "flow_disk_imports"("buyerOrganisationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "flow_disk_imports_buyerOrganisationId_fileSha256_idx" ON "flow_disk_imports"("buyerOrganisationId", "fileSha256");

-- CreateIndex
CREATE UNIQUE INDEX "flow_disk_imports_buyerOrganisationId_reference_key" ON "flow_disk_imports"("buyerOrganisationId", "reference");

-- CreateIndex
CREATE INDEX "import_row_issues_importId_rowNumber_idx" ON "import_row_issues"("importId", "rowNumber");

-- CreateIndex
CREATE INDEX "buyer_invoices_buyerOrganisationId_saleDateFrom_idx" ON "buyer_invoices"("buyerOrganisationId", "saleDateFrom");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_invoices_buyerOrganisationId_reference_key" ON "buyer_invoices"("buyerOrganisationId", "reference");

-- CreateIndex
CREATE INDEX "invoice_charges_invoiceId_sortOrder_idx" ON "invoice_charges"("invoiceId", "sortOrder");

-- CreateIndex
CREATE INDEX "invoice_grade_summaries_invoiceId_idx" ON "invoice_grade_summaries"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_invoiceId_key" ON "purchases"("invoiceId");

-- CreateIndex
CREATE INDEX "purchases_buyerOrganisationId_saleDate_idx" ON "purchases"("buyerOrganisationId", "saleDate");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_buyerOrganisationId_reference_key" ON "purchases"("buyerOrganisationId", "reference");

-- CreateIndex
CREATE INDEX "bales_buyerOrganisationId_status_idx" ON "bales"("buyerOrganisationId", "status");

-- CreateIndex
CREATE INDEX "bales_buyerOrganisationId_growerNo_idx" ON "bales"("buyerOrganisationId", "growerNo");

-- CreateIndex
CREATE INDEX "bales_buyerOrganisationId_buyerGrade_idx" ON "bales"("buyerOrganisationId", "buyerGrade");

-- CreateIndex
CREATE INDEX "bales_buyerOrganisationId_purchaseId_idx" ON "bales"("buyerOrganisationId", "purchaseId");

-- CreateIndex
CREATE INDEX "bales_currentWarehouseId_currentBayId_currentRowId_idx" ON "bales"("currentWarehouseId", "currentBayId", "currentRowId");

-- CreateIndex
CREATE UNIQUE INDEX "bales_season_barcode_key" ON "bales"("season", "barcode");

-- CreateIndex
CREATE INDEX "receiving_sessions_buyerOrganisationId_purchaseId_status_idx" ON "receiving_sessions"("buyerOrganisationId", "purchaseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "receiving_sessions_buyerOrganisationId_reference_key" ON "receiving_sessions"("buyerOrganisationId", "reference");

-- CreateIndex
CREATE INDEX "receiving_scans_sessionId_scannedAt_idx" ON "receiving_scans"("sessionId", "scannedAt");

-- CreateIndex
CREATE INDEX "receiving_scans_baleId_idx" ON "receiving_scans"("baleId");

-- CreateIndex
CREATE INDEX "receiving_scans_buyerOrganisationId_barcode_idx" ON "receiving_scans"("buyerOrganisationId", "barcode");

-- CreateIndex
CREATE INDEX "receiving_exceptions_buyerOrganisationId_status_idx" ON "receiving_exceptions"("buyerOrganisationId", "status");

-- CreateIndex
CREATE INDEX "receiving_exceptions_sessionId_idx" ON "receiving_exceptions"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_buyerOrganisationId_code_key" ON "warehouses"("buyerOrganisationId", "code");

-- CreateIndex
CREATE INDEX "bays_buyerOrganisationId_idx" ON "bays"("buyerOrganisationId");

-- CreateIndex
CREATE UNIQUE INDEX "bays_warehouseId_code_key" ON "bays"("warehouseId", "code");

-- CreateIndex
CREATE INDEX "warehouse_rows_buyerOrganisationId_idx" ON "warehouse_rows"("buyerOrganisationId");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_rows_bayId_code_key" ON "warehouse_rows"("bayId", "code");

-- CreateIndex
CREATE INDEX "bale_movements_baleId_performedAt_idx" ON "bale_movements"("baleId", "performedAt");

-- CreateIndex
CREATE INDEX "bale_movements_buyerOrganisationId_performedAt_idx" ON "bale_movements"("buyerOrganisationId", "performedAt");

-- CreateIndex
CREATE INDEX "bale_events_baleId_occurredAt_idx" ON "bale_events"("baleId", "occurredAt");

-- CreateIndex
CREATE INDEX "bale_events_buyerOrganisationId_occurredAt_idx" ON "bale_events"("buyerOrganisationId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "processing_companies_buyerOrganisationId_name_key" ON "processing_companies"("buyerOrganisationId", "name");

-- CreateIndex
CREATE INDEX "dispatches_buyerOrganisationId_status_idx" ON "dispatches"("buyerOrganisationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "dispatches_buyerOrganisationId_reference_key" ON "dispatches"("buyerOrganisationId", "reference");

-- CreateIndex
CREATE INDEX "dispatch_bales_buyerOrganisationId_status_idx" ON "dispatch_bales"("buyerOrganisationId", "status");

-- CreateIndex
CREATE INDEX "dispatch_bales_baleId_idx" ON "dispatch_bales"("baleId");

-- CreateIndex
CREATE UNIQUE INDEX "dispatch_bales_dispatchId_baleId_key" ON "dispatch_bales"("dispatchId", "baleId");

-- CreateIndex
CREATE INDEX "processing_returns_buyerOrganisationId_dispatchId_idx" ON "processing_returns"("buyerOrganisationId", "dispatchId");

-- CreateIndex
CREATE UNIQUE INDEX "processing_returns_buyerOrganisationId_reference_key" ON "processing_returns"("buyerOrganisationId", "reference");

-- CreateIndex
CREATE INDEX "return_bales_returnId_idx" ON "return_bales"("returnId");

-- CreateIndex
CREATE INDEX "return_bales_buyerOrganisationId_originalBaleId_idx" ON "return_bales"("buyerOrganisationId", "originalBaleId");

-- CreateIndex
CREATE INDEX "bale_lineage_buyerOrganisationId_idx" ON "bale_lineage"("buyerOrganisationId");

-- CreateIndex
CREATE UNIQUE INDEX "bale_lineage_originalBaleId_newBaleId_key" ON "bale_lineage"("originalBaleId", "newBaleId");

-- CreateIndex
CREATE INDEX "audit_logs_buyerOrganisationId_occurredAt_idx" ON "audit_logs"("buyerOrganisationId", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_principalType_principalId_idx" ON "audit_logs"("principalType", "principalId");

-- AddForeignKey
ALTER TABLE "buyer_users" ADD CONSTRAINT "buyer_users_buyerOrganisationId_fkey" FOREIGN KEY ("buyerOrganisationId") REFERENCES "buyer_organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_buyerOrganisationId_fkey" FOREIGN KEY ("buyerOrganisationId") REFERENCES "buyer_organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_disk_imports" ADD CONSTRAINT "flow_disk_imports_buyerOrganisationId_fkey" FOREIGN KEY ("buyerOrganisationId") REFERENCES "buyer_organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_disk_imports" ADD CONSTRAINT "flow_disk_imports_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "buyer_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_disk_imports" ADD CONSTRAINT "flow_disk_imports_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_row_issues" ADD CONSTRAINT "import_row_issues_importId_fkey" FOREIGN KEY ("importId") REFERENCES "flow_disk_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_invoices" ADD CONSTRAINT "buyer_invoices_buyerOrganisationId_fkey" FOREIGN KEY ("buyerOrganisationId") REFERENCES "buyer_organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_charges" ADD CONSTRAINT "invoice_charges_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "buyer_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_grade_summaries" ADD CONSTRAINT "invoice_grade_summaries_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "buyer_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_buyerOrganisationId_fkey" FOREIGN KEY ("buyerOrganisationId") REFERENCES "buyer_organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "buyer_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bales" ADD CONSTRAINT "bales_buyerOrganisationId_fkey" FOREIGN KEY ("buyerOrganisationId") REFERENCES "buyer_organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bales" ADD CONSTRAINT "bales_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bales" ADD CONSTRAINT "bales_currentWarehouseId_fkey" FOREIGN KEY ("currentWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bales" ADD CONSTRAINT "bales_currentBayId_fkey" FOREIGN KEY ("currentBayId") REFERENCES "bays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bales" ADD CONSTRAINT "bales_currentRowId_fkey" FOREIGN KEY ("currentRowId") REFERENCES "warehouse_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_sessions" ADD CONSTRAINT "receiving_sessions_buyerOrganisationId_fkey" FOREIGN KEY ("buyerOrganisationId") REFERENCES "buyer_organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_sessions" ADD CONSTRAINT "receiving_sessions_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_scans" ADD CONSTRAINT "receiving_scans_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "receiving_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_scans" ADD CONSTRAINT "receiving_scans_baleId_fkey" FOREIGN KEY ("baleId") REFERENCES "bales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_exceptions" ADD CONSTRAINT "receiving_exceptions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "receiving_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_buyerOrganisationId_fkey" FOREIGN KEY ("buyerOrganisationId") REFERENCES "buyer_organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bays" ADD CONSTRAINT "bays_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_rows" ADD CONSTRAINT "warehouse_rows_bayId_fkey" FOREIGN KEY ("bayId") REFERENCES "bays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bale_movements" ADD CONSTRAINT "bale_movements_baleId_fkey" FOREIGN KEY ("baleId") REFERENCES "bales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bale_events" ADD CONSTRAINT "bale_events_baleId_fkey" FOREIGN KEY ("baleId") REFERENCES "bales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_companies" ADD CONSTRAINT "processing_companies_buyerOrganisationId_fkey" FOREIGN KEY ("buyerOrganisationId") REFERENCES "buyer_organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_buyerOrganisationId_fkey" FOREIGN KEY ("buyerOrganisationId") REFERENCES "buyer_organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_processingCompanyId_fkey" FOREIGN KEY ("processingCompanyId") REFERENCES "processing_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_bales" ADD CONSTRAINT "dispatch_bales_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "dispatches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_bales" ADD CONSTRAINT "dispatch_bales_baleId_fkey" FOREIGN KEY ("baleId") REFERENCES "bales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_returns" ADD CONSTRAINT "processing_returns_buyerOrganisationId_fkey" FOREIGN KEY ("buyerOrganisationId") REFERENCES "buyer_organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_returns" ADD CONSTRAINT "processing_returns_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "dispatches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_bales" ADD CONSTRAINT "return_bales_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "processing_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bale_lineage" ADD CONSTRAINT "bale_lineage_originalBaleId_fkey" FOREIGN KEY ("originalBaleId") REFERENCES "bales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bale_lineage" ADD CONSTRAINT "bale_lineage_newBaleId_fkey" FOREIGN KEY ("newBaleId") REFERENCES "bales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

