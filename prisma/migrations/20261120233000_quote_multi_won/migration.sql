-- Several sent quotes on one dossier can be won at the same time.
ALTER TABLE "crm_ExternalQuotes" ADD COLUMN "won_at" TIMESTAMP(3);
