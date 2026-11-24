-- Extra velden voor de nieuwe aanvraag en de klant. Geen DROP, geen hernoemen.

CREATE TYPE "crm_Account_Role" AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH');

CREATE TYPE "crm_Project_Group" AS ENUM ('AFHALING', 'HAROL', 'NIEUWBOUW', 'PROJECT', 'RENOVATIE');

ALTER TABLE "crm_Accounts" ADD COLUMN "account_role" "crm_Account_Role";
ALTER TABLE "crm_Accounts" ADD COLUMN "mobile_phone" TEXT;
ALTER TABLE "crm_Accounts" ADD COLUMN "tax_rate_id" UUID;

ALTER TABLE "crm_Opportunities" ADD COLUMN "price_request_date" DATE;
ALTER TABLE "crm_Opportunities" ADD COLUMN "project_group" "crm_Project_Group";
ALTER TABLE "crm_Opportunities" ADD COLUMN "seller_name" TEXT;

ALTER TABLE "crm_Accounts" ADD CONSTRAINT "crm_Accounts_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "Invoice_TaxRates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "crm_Accounts_tax_rate_id_idx" ON "crm_Accounts"("tax_rate_id");
