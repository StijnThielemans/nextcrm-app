-- Logikal-project en geïmporteerde raamposities op het offertedossier.

ALTER TABLE "crm_Opportunities" ADD COLUMN "logikal_project_id" TEXT;
ALTER TABLE "crm_Opportunities" ADD COLUMN "logikal_project_name" TEXT;
ALTER TABLE "crm_Opportunities" ADD COLUMN "logikal_link_state" TEXT;
ALTER TABLE "crm_Opportunities" ADD COLUMN "logikal_create_token" TEXT;
ALTER TABLE "crm_Opportunities" ADD COLUMN "logikal_create_started_at" TIMESTAMP(3);
ALTER TABLE "crm_Opportunities" ADD COLUMN "logikal_imported_at" TIMESTAMP(3);

CREATE TABLE "crm_LogikalPositions" (
    "id" UUID NOT NULL,
    "dossier_id" UUID NOT NULL,
    "elevation_key" TEXT NOT NULL,
    "position_name" TEXT NOT NULL,
    "quantity" DECIMAL(18,2) NOT NULL,
    "quote_text" TEXT,
    "description" TEXT,
    "drawing_key" TEXT,
    "drawing_name" TEXT,
    "drawing_mime" TEXT,
    "sort_order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_LogikalPositions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_LogikalPositions_dossier_id_elevation_key_key" ON "crm_LogikalPositions"("dossier_id", "elevation_key");
CREATE INDEX "crm_LogikalPositions_dossier_id_idx" ON "crm_LogikalPositions"("dossier_id");

ALTER TABLE "crm_LogikalPositions" ADD CONSTRAINT "crm_LogikalPositions_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "crm_Opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
