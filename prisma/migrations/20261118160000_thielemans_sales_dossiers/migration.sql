-- Thielemans verkoopflow: offertedossiers op crm_Opportunities, externe offertes als nieuwe tabellen.
-- Geen DROP, geen hernoemen, geen backfill van bestaande deals.

ALTER TYPE "Language" ADD VALUE 'nl';

ALTER TYPE "DocumentSystemType" ADD VALUE 'INTERNAL_SUPPLIER_QUOTE';
ALTER TYPE "DocumentSystemType" ADD VALUE 'CUSTOMER_QUOTE';
ALTER TYPE "DocumentSystemType" ADD VALUE 'PLAN';
ALTER TYPE "DocumentSystemType" ADD VALUE 'PHOTO';

CREATE TYPE "crm_Dossier_Status" AS ENUM ('NIEUW', 'IN_OPMAAK', 'WACHTEN_OP_INFORMATIE', 'OFFERTE_KLAAR', 'OFFERTE_VERSTUURD', 'OPVOLGING', 'IN_ONDERHANDELING', 'GEWONNEN', 'VERLOREN');

CREATE TYPE "crm_Request_Channel" AS ENUM ('PHONE', 'EMAIL_OFFERTE', 'EMAIL_SELLER', 'SITE_VISIT', 'SHOWROOM');

CREATE TYPE "crm_Customer_Kind" AS ENUM ('COMPANY', 'PRIVATE');

CREATE TYPE "crm_ExternalQuote_Status" AS ENUM ('ACTIVE', 'HISTORICAL');

CREATE TYPE "crm_QuoteSend_Method" AS ENUM ('MANUAL', 'EMAIL');

ALTER TABLE "crm_Accounts" ADD COLUMN "customer_kind" "crm_Customer_Kind";

ALTER TABLE "crm_Opportunities" ADD COLUMN "is_dossier" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "crm_Opportunities" ADD COLUMN "dossier_number" TEXT;
ALTER TABLE "crm_Opportunities" ADD COLUMN "dossier_status" "crm_Dossier_Status";
ALTER TABLE "crm_Opportunities" ADD COLUMN "project_street" TEXT;
ALTER TABLE "crm_Opportunities" ADD COLUMN "project_postal_code" TEXT;
ALTER TABLE "crm_Opportunities" ADD COLUMN "project_city" TEXT;
ALTER TABLE "crm_Opportunities" ADD COLUMN "project_country" TEXT;
ALTER TABLE "crm_Opportunities" ADD COLUMN "request_date" DATE;
ALTER TABLE "crm_Opportunities" ADD COLUMN "source_channel" "crm_Request_Channel";
ALTER TABLE "crm_Opportunities" ADD COLUMN "follow_up_date" DATE;
ALTER TABLE "crm_Opportunities" ADD COLUMN "internal_notes" TEXT;
ALTER TABLE "crm_Opportunities" ADD COLUMN "lost_reason" TEXT;
ALTER TABLE "crm_Opportunities" ADD COLUMN "won_at" TIMESTAMP(3);
ALTER TABLE "crm_Opportunities" ADD COLUMN "lost_at" TIMESTAMP(3);
ALTER TABLE "crm_Opportunities" ADD COLUMN "accepted_quote_id" UUID;

CREATE UNIQUE INDEX "crm_Opportunities_dossier_number_key" ON "crm_Opportunities"("dossier_number");
CREATE INDEX "crm_Opportunities_is_dossier_dossier_status_idx" ON "crm_Opportunities"("is_dossier", "dossier_status");
CREATE INDEX "crm_Opportunities_is_dossier_assigned_to_idx" ON "crm_Opportunities"("is_dossier", "assigned_to");
CREATE INDEX "crm_Opportunities_is_dossier_follow_up_date_idx" ON "crm_Opportunities"("is_dossier", "follow_up_date");
CREATE INDEX "crm_Opportunities_is_dossier_request_date_idx" ON "crm_Opportunities"("is_dossier", "request_date");
CREATE INDEX "crm_Opportunities_accepted_quote_id_idx" ON "crm_Opportunities"("accepted_quote_id");

CREATE TABLE "crm_DossierChannelEvents" (
    "id" UUID NOT NULL,
    "dossier_id" UUID NOT NULL,
    "channel" "crm_Request_Channel" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "seller_id" UUID NOT NULL,
    "note" TEXT,
    "is_original" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,

    CONSTRAINT "crm_DossierChannelEvents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_ExternalQuoteFamilies" (
    "id" UUID NOT NULL,
    "dossier_id" UUID NOT NULL,
    "supplier" TEXT NOT NULL,
    "configurator_name" TEXT NOT NULL,
    "supplier_reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,

    CONSTRAINT "crm_ExternalQuoteFamilies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_ExternalQuotes" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "quote_number" TEXT NOT NULL,
    "quote_date" DATE NOT NULL,
    "pdf_document_id" UUID NOT NULL,
    "cost_excl_vat" DECIMAL(14,2) NOT NULL,
    "sell_excl_vat" DECIMAL(14,2) NOT NULL,
    "vat_rate" DECIMAL(5,2) NOT NULL,
    "margin_euro" DECIMAL(14,2) NOT NULL,
    "margin_percent" DECIMAL(7,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "internal_notes" TEXT,
    "status" "crm_ExternalQuote_Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "crm_ExternalQuotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_QuoteSends" (
    "id" UUID NOT NULL,
    "dossier_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "method" "crm_QuoteSend_Method" NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "follow_up_date" DATE NOT NULL,
    "email_to" TEXT,
    "sent_by" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_QuoteSends_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_DossierChannelEvents_dossier_id_idx" ON "crm_DossierChannelEvents"("dossier_id");
CREATE INDEX "crm_DossierChannelEvents_seller_id_idx" ON "crm_DossierChannelEvents"("seller_id");
CREATE INDEX "crm_DossierChannelEvents_occurred_at_idx" ON "crm_DossierChannelEvents"("occurred_at");
CREATE UNIQUE INDEX "crm_DossierChannelEvents_one_original" ON "crm_DossierChannelEvents"("dossier_id") WHERE "is_original";

CREATE UNIQUE INDEX "crm_ExternalQuoteFamilies_dossier_id_supplier_supplier_reference_key" ON "crm_ExternalQuoteFamilies"("dossier_id", "supplier", "supplier_reference");
CREATE INDEX "crm_ExternalQuoteFamilies_dossier_id_idx" ON "crm_ExternalQuoteFamilies"("dossier_id");

CREATE UNIQUE INDEX "crm_ExternalQuotes_family_id_version_key" ON "crm_ExternalQuotes"("family_id", "version");
CREATE INDEX "crm_ExternalQuotes_family_id_idx" ON "crm_ExternalQuotes"("family_id");
CREATE INDEX "crm_ExternalQuotes_pdf_document_id_idx" ON "crm_ExternalQuotes"("pdf_document_id");
CREATE INDEX "crm_ExternalQuotes_status_idx" ON "crm_ExternalQuotes"("status");
CREATE INDEX "crm_ExternalQuotes_deletedAt_idx" ON "crm_ExternalQuotes"("deletedAt");

CREATE INDEX "crm_QuoteSends_dossier_id_sent_at_idx" ON "crm_QuoteSends"("dossier_id", "sent_at");
CREATE INDEX "crm_QuoteSends_quote_id_idx" ON "crm_QuoteSends"("quote_id");
CREATE INDEX "crm_QuoteSends_document_id_idx" ON "crm_QuoteSends"("document_id");
CREATE INDEX "crm_QuoteSends_sent_by_idx" ON "crm_QuoteSends"("sent_by");

ALTER TABLE "crm_DossierChannelEvents" ADD CONSTRAINT "crm_DossierChannelEvents_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "crm_Opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_DossierChannelEvents" ADD CONSTRAINT "crm_DossierChannelEvents_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "crm_ExternalQuoteFamilies" ADD CONSTRAINT "crm_ExternalQuoteFamilies_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "crm_Opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "crm_ExternalQuotes" ADD CONSTRAINT "crm_ExternalQuotes_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "crm_ExternalQuoteFamilies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_ExternalQuotes" ADD CONSTRAINT "crm_ExternalQuotes_pdf_document_id_fkey" FOREIGN KEY ("pdf_document_id") REFERENCES "Documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "crm_QuoteSends" ADD CONSTRAINT "crm_QuoteSends_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "crm_Opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_QuoteSends" ADD CONSTRAINT "crm_QuoteSends_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "crm_ExternalQuotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_QuoteSends" ADD CONSTRAINT "crm_QuoteSends_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_QuoteSends" ADD CONSTRAINT "crm_QuoteSends_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "crm_Opportunities" ADD CONSTRAINT "crm_Opportunities_accepted_quote_id_fkey" FOREIGN KEY ("accepted_quote_id") REFERENCES "crm_ExternalQuotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "crm_ExternalQuotes" ADD CONSTRAINT "crm_ExternalQuotes_margin_check" CHECK (
  "margin_euro" = ("sell_excl_vat" - "cost_excl_vat")
  AND (
    ("sell_excl_vat" = 0 AND "margin_percent" IS NULL)
    OR ("sell_excl_vat" <> 0 AND "margin_percent" = round(("margin_euro" / "sell_excl_vat") * 100, 2))
  )
  AND "cost_excl_vat" >= 0
  AND "sell_excl_vat" >= 0
  AND "vat_rate" >= 0
  AND "vat_rate" <= 100
);

INSERT INTO "NumberSeries" ("id", "scope", "name", "template", "resetPolicy", "counter", "isDefault", "active", "updatedAt")
SELECT gen_random_uuid(), 'dossier', 'Offertedossier', 'OFF-{YYYY}-{####}', 'YEARLY', 0, true, true, now()
WHERE NOT EXISTS (
  SELECT 1 FROM "NumberSeries" WHERE "scope" = 'dossier' AND "isDefault" = true
);
