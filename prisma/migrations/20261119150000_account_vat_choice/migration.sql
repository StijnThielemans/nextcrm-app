-- BTW-keuze op de klant. Geen DROP, geen hernoemen.
-- Medecontractant is verlegging van heffing, geen percentage.

CREATE TYPE "crm_Vat_Choice" AS ENUM ('EXCL_21', 'EXCL_6', 'MEDECONTRACTANT');

ALTER TABLE "crm_Accounts" ADD COLUMN "vat_choice" "crm_Vat_Choice";
