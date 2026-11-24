-- Kolomvolgorde per gebruiker. Geen DROP, geen hernoemen.

ALTER TABLE "Users" ADD COLUMN "table_layouts" JSONB;
