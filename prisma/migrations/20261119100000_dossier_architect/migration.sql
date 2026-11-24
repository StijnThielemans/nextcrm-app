-- Optionele architect op een offertedossier. Geen DROP, geen hernoemen.

ALTER TABLE "crm_Opportunities" ADD COLUMN "architect_name" TEXT;
ALTER TABLE "crm_Opportunities" ADD COLUMN "architect_external_id" TEXT;
