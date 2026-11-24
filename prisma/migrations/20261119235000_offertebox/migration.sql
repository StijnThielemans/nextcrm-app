-- Offertebox: mails van offerte@thielemans.be die verdeeld worden tot de offerte verstuurd is.

CREATE TABLE "crm_OfferteboxItems" (
    "id" UUID NOT NULL,
    "message_key" TEXT NOT NULL,
    "from_name" TEXT,
    "from_email" TEXT,
    "subject" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "preview" TEXT,
    "seller_name" TEXT,
    "dossier_id" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_OfferteboxItems_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_OfferteboxItems_message_key_key" ON "crm_OfferteboxItems"("message_key");
CREATE INDEX "crm_OfferteboxItems_received_at_idx" ON "crm_OfferteboxItems"("received_at");
CREATE INDEX "crm_OfferteboxItems_dossier_id_idx" ON "crm_OfferteboxItems"("dossier_id");

ALTER TABLE "crm_OfferteboxItems" ADD CONSTRAINT "crm_OfferteboxItems_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "crm_Opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
