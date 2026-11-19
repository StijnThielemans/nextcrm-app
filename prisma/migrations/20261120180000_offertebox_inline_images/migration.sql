-- Offertebox: HTML van de mail, zodat inline afbeeldingen op hun plek blijven.

ALTER TABLE "crm_OfferteboxItems" ADD COLUMN "body_html" TEXT;

ALTER TABLE "crm_OfferteboxAttachments" ADD COLUMN "content_id" TEXT;
ALTER TABLE "crm_OfferteboxAttachments" ADD COLUMN "inline" BOOLEAN NOT NULL DEFAULT false;
