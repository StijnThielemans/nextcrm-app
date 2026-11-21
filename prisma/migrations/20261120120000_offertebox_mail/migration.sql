-- Offertebox: leesbare mailtekst en bijlagen bij een gesleepte .eml.

ALTER TABLE "crm_OfferteboxItems" ADD COLUMN "body_text" TEXT;

CREATE TABLE "crm_OfferteboxAttachments" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "is_image" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_OfferteboxAttachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_OfferteboxAttachments_item_id_idx" ON "crm_OfferteboxAttachments"("item_id");

ALTER TABLE "crm_OfferteboxAttachments" ADD CONSTRAINT "crm_OfferteboxAttachments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "crm_OfferteboxItems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
