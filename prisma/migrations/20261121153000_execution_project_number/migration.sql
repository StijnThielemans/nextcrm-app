ALTER TABLE "crm_Opportunities" ADD COLUMN "execution_project_number" TEXT;
ALTER TABLE "crm_Opportunities" ADD COLUMN "project_created_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "crm_Opportunities_execution_project_number_key" ON "crm_Opportunities"("execution_project_number");

INSERT INTO "NumberSeries" ("id", "scope", "name", "template", "resetPolicy", "counter", "isDefault", "active", "updatedAt")
SELECT gen_random_uuid(), 'project', 'Project', '1{#######}{YY}', 'YEARLY', 0, true, true, now()
WHERE NOT EXISTS (
  SELECT 1 FROM "NumberSeries" WHERE "scope" = 'project' AND "isDefault" = true
);
