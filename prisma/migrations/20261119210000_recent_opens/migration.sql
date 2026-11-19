-- Laatst geopende klanten en offertedossiers, per gebruiker.
-- Geen DROP, geen hernoemen van bestaande tabellen.

CREATE TYPE "crm_RecentOpen_Kind" AS ENUM ('ACCOUNT', 'DOSSIER');

CREATE TABLE "crm_RecentOpens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "crm_RecentOpen_Kind" NOT NULL,
    "record_id" UUID NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_RecentOpens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_RecentOpens_user_id_kind_record_id_key" ON "crm_RecentOpens"("user_id", "kind", "record_id");
CREATE INDEX "crm_RecentOpens_user_id_kind_opened_at_idx" ON "crm_RecentOpens"("user_id", "kind", "opened_at");

ALTER TABLE "crm_RecentOpens" ADD CONSTRAINT "crm_RecentOpens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
