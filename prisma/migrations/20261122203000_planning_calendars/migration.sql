-- Week calendars: plan dates on the project, hand-placed items, and crew per day.

CREATE TYPE "crm_PlanningBoard" AS ENUM ('BINNENDIENST', 'BUITENDIENST', 'DIENST_NA_VERKOOP');

CREATE TYPE "crm_PlanningKind" AS ENUM ('CHASSIS', 'GLASS', 'OFFICE', 'MANUAL');

ALTER TABLE "crm_Opportunities" ADD COLUMN "chassis_plan_start" DATE,
ADD COLUMN "chassis_plan_end" DATE,
ADD COLUMN "glass_plan_start" DATE,
ADD COLUMN "glass_plan_end" DATE,
ADD COLUMN "office_plan_start" DATE,
ADD COLUMN "office_plan_end" DATE;

CREATE TABLE "crm_PlanningItems" (
    "id" UUID NOT NULL,
    "board" "crm_PlanningBoard" NOT NULL,
    "text" TEXT NOT NULL,
    "opportunity_id" UUID,
    "quote_id" UUID,
    "plan_start" DATE,
    "plan_end" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "crm_PlanningItems_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_PlanningAssignments" (
    "id" UUID NOT NULL,
    "resource" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "kind" "crm_PlanningKind" NOT NULL,
    "opportunity_id" UUID,
    "item_id" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,

    CONSTRAINT "crm_PlanningAssignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_PlanningItems_board_deletedAt_idx" ON "crm_PlanningItems"("board", "deletedAt");
CREATE INDEX "crm_PlanningItems_opportunity_id_idx" ON "crm_PlanningItems"("opportunity_id");
CREATE INDEX "crm_PlanningItems_quote_id_idx" ON "crm_PlanningItems"("quote_id");
CREATE INDEX "crm_PlanningAssignments_opportunity_id_kind_day_idx" ON "crm_PlanningAssignments"("opportunity_id", "kind", "day");
CREATE INDEX "crm_PlanningAssignments_item_id_day_idx" ON "crm_PlanningAssignments"("item_id", "day");
CREATE INDEX "crm_PlanningAssignments_day_idx" ON "crm_PlanningAssignments"("day");

ALTER TABLE "crm_PlanningItems" ADD CONSTRAINT "crm_PlanningItems_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_Opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_PlanningItems" ADD CONSTRAINT "crm_PlanningItems_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "crm_ExternalQuotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_PlanningAssignments" ADD CONSTRAINT "crm_PlanningAssignments_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_Opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_PlanningAssignments" ADD CONSTRAINT "crm_PlanningAssignments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "crm_PlanningItems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
