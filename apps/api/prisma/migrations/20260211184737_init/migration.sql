-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'STARTER', 'PRO', 'AGENCY');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'MEMBER', 'AGENCY_ADMIN', 'AGENCY_VIEWER');

-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('UPLOAD', 'EMAIL_FORWARD');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('CREATED', 'UPLOADED', 'EXTRACTION_RUNNING', 'EXTRACTED', 'EXTRACTION_FAILED', 'NORMALIZATION_RUNNING', 'NORMALIZED', 'NORMALIZATION_FAILED', 'DETECTION_RUNNING', 'DETECTED', 'DETECTION_FAILED', 'DONE');

-- CreateEnum
CREATE TYPE "LineItemType" AS ENUM ('CHARGE', 'REFUND', 'CREDIT');

-- CreateEnum
CREATE TYPE "Cadence" AS ENUM ('MONTHLY', 'YEARLY', 'WEEKLY', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "VendorCategory" AS ENUM ('SHOPIFY_APP', 'SAAS', 'PAYMENT', 'SHIPPING', 'MARKETING', 'ANALYTICS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'CANCELED', 'SUSPECTED_UNUSED');

-- CreateEnum
CREATE TYPE "LeakType" AS ENUM ('MOM_SPIKE', 'DUPLICATE_CHARGE', 'POST_CANCELLATION', 'TRIAL_TO_PAID', 'UNINSTALLED_APP_CHARGE', 'UPCOMING_RENEWAL');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'DISMISSED', 'RESOLVED', 'REOPENED');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('PDF_TEXT_SPAN', 'CSV_ROW', 'IMAGE_OCR_LINE', 'MANUAL_NOTE');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('REFUND_REQUEST', 'CANCEL_REQUEST', 'DOWNGRADE_REQUEST', 'CLARIFICATION');

-- CreateEnum
CREATE TYPE "ActionRequestStatus" AS ENUM ('DRAFT', 'APPROVED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ActionRunStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReportPeriod" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "planStatus" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "shopifyUserId" TEXT,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "shopifyDomain" TEXT NOT NULL,
    "shopifyShopId" TEXT,
    "displayName" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
    "installedAt" TIMESTAMP(3),
    "uninstalledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyToken" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "source" "DocumentSource" NOT NULL DEFAULT 'UPLOAD',
    "vendorHint" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "DocStatus" NOT NULL DEFAULT 'CREATED',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedArtifact" (
    "id" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "textContent" TEXT NOT NULL,
    "metaJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractedArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormalizedInvoice" (
    "id" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "vendorId" TEXT,
    "currency" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "billingPeriodStart" TIMESTAMP(3),
    "billingPeriodEnd" TIMESTAMP(3),
    "totalAmount" DECIMAL(18,6) NOT NULL,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NormalizedInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormalizedLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "vendorId" TEXT,
    "itemType" "LineItemType" NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(18,6),
    "unitPrice" DECIMAL(18,6),
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringCadence" "Cadence",
    "planName" TEXT,
    "productCode" TEXT,
    "taxAmount" DECIMAL(18,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NormalizedLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "aliases" TEXT[],
    "supportEmail" TEXT,
    "website" TEXT,
    "category" "VendorCategory" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorOnShop" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" "VendorStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSeenAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "VendorOnShop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeakFinding" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "type" "LeakType" NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "estimatedSavingsAmount" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "vendorId" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "primaryLineItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeakFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceRef" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "documentVersionId" TEXT,
    "kind" "EvidenceKind" NOT NULL,
    "pointerJson" JSONB NOT NULL,
    "excerpt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionRequest" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "type" "ActionType" NOT NULL,
    "status" "ActionRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "toEmail" TEXT NOT NULL,
    "ccEmails" TEXT[],
    "subject" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "attachmentKey" TEXT,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionRun" (
    "id" TEXT NOT NULL,
    "actionRequestId" TEXT NOT NULL,
    "status" "ActionRunStatus" NOT NULL DEFAULT 'QUEUED',
    "mailgunMessageId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailEvent" (
    "id" TEXT NOT NULL,
    "actionRunId" TEXT,
    "mailgunMessageId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "period" "ReportPeriod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "summaryJson" JSONB NOT NULL,
    "storageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "shopId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metaJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageCounter" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "shopId" TEXT,
    "day" TIMESTAMP(3) NOT NULL,
    "metric" TEXT NOT NULL,
    "value" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_shopifyUserId_key" ON "User"("shopifyUserId");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_orgId_userId_key" ON "Membership"("orgId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopifyDomain_key" ON "Shop"("shopifyDomain");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopifyShopId_key" ON "Shop"("shopifyShopId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyToken_shopId_key" ON "ShopifyToken"("shopId");

-- CreateIndex
CREATE INDEX "Document_shopId_createdAt_idx" ON "Document"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "Document_orgId_idx" ON "Document"("orgId");

-- CreateIndex
CREATE INDEX "DocumentVersion_status_createdAt_idx" ON "DocumentVersion"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_version_key" ON "DocumentVersion"("documentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractedArtifact_documentVersionId_key" ON "ExtractedArtifact"("documentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "NormalizedInvoice_documentVersionId_key" ON "NormalizedInvoice"("documentVersionId");

-- CreateIndex
CREATE INDEX "NormalizedInvoice_vendorId_invoiceDate_idx" ON "NormalizedInvoice"("vendorId", "invoiceDate");

-- CreateIndex
CREATE INDEX "NormalizedLineItem_shopId_vendorId_periodStart_idx" ON "NormalizedLineItem"("shopId", "vendorId", "periodStart");

-- CreateIndex
CREATE INDEX "NormalizedLineItem_shopId_periodStart_amount_idx" ON "NormalizedLineItem"("shopId", "periodStart", "amount");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_canonicalName_key" ON "Vendor"("canonicalName");

-- CreateIndex
CREATE INDEX "VendorOnShop_shopId_status_idx" ON "VendorOnShop"("shopId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VendorOnShop_shopId_vendorId_key" ON "VendorOnShop"("shopId", "vendorId");

-- CreateIndex
CREATE INDEX "LeakFinding_shopId_status_createdAt_idx" ON "LeakFinding"("shopId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "LeakFinding_shopId_type_createdAt_idx" ON "LeakFinding"("shopId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceRef_findingId_idx" ON "EvidenceRef"("findingId");

-- CreateIndex
CREATE INDEX "ActionRequest_shopId_status_createdAt_idx" ON "ActionRequest"("shopId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ActionRun_status_createdAt_idx" ON "ActionRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MailEvent_mailgunMessageId_occurredAt_idx" ON "MailEvent"("mailgunMessageId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_shopId_period_periodStart_periodEnd_key" ON "Report"("shopId", "period", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCounter_orgId_shopId_day_metric_key" ON "UsageCounter"("orgId", "shopId", "day", "metric");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopifyToken" ADD CONSTRAINT "ShopifyToken_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedArtifact" ADD CONSTRAINT "ExtractedArtifact_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormalizedInvoice" ADD CONSTRAINT "NormalizedInvoice_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormalizedInvoice" ADD CONSTRAINT "NormalizedInvoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormalizedLineItem" ADD CONSTRAINT "NormalizedLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "NormalizedInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormalizedLineItem" ADD CONSTRAINT "NormalizedLineItem_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormalizedLineItem" ADD CONSTRAINT "NormalizedLineItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorOnShop" ADD CONSTRAINT "VendorOnShop_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorOnShop" ADD CONSTRAINT "VendorOnShop_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeakFinding" ADD CONSTRAINT "LeakFinding_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeakFinding" ADD CONSTRAINT "LeakFinding_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeakFinding" ADD CONSTRAINT "LeakFinding_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeakFinding" ADD CONSTRAINT "LeakFinding_primaryLineItemId_fkey" FOREIGN KEY ("primaryLineItemId") REFERENCES "NormalizedLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRef" ADD CONSTRAINT "EvidenceRef_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "LeakFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionRequest" ADD CONSTRAINT "ActionRequest_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "LeakFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionRequest" ADD CONSTRAINT "ActionRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionRequest" ADD CONSTRAINT "ActionRequest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionRequest" ADD CONSTRAINT "ActionRequest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionRequest" ADD CONSTRAINT "ActionRequest_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionRun" ADD CONSTRAINT "ActionRun_actionRequestId_fkey" FOREIGN KEY ("actionRequestId") REFERENCES "ActionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailEvent" ADD CONSTRAINT "MailEvent_actionRunId_fkey" FOREIGN KEY ("actionRunId") REFERENCES "ActionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageCounter" ADD CONSTRAINT "UsageCounter_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageCounter" ADD CONSTRAINT "UsageCounter_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
