-- The live Logikal connection is unused. Window positions come from the uploaded quote PDF.

DROP TABLE "crm_LogikalPositions";

ALTER TABLE "crm_Opportunities" DROP COLUMN "logikal_project_id",
DROP COLUMN "logikal_project_name",
DROP COLUMN "logikal_link_state",
DROP COLUMN "logikal_create_token",
DROP COLUMN "logikal_create_started_at",
DROP COLUMN "logikal_imported_at";
