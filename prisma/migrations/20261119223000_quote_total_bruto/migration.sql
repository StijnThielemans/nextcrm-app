-- Gross total (totaal bruto) on a quote version. Existing rows stay null.
-- No tables are dropped or renamed.

ALTER TABLE "crm_ExternalQuotes" ADD COLUMN "total_bruto" DECIMAL(14,2);

ALTER TABLE "crm_ExternalQuotes" ADD CONSTRAINT "crm_ExternalQuotes_total_bruto_check"
  CHECK ("total_bruto" IS NULL OR "total_bruto" >= 0);
