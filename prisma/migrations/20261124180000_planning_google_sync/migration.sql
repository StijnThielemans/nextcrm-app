CREATE TABLE "crm_PlanningGoogleLinks" (
    "id" UUID NOT NULL,
    "board" "crm_PlanningBoard" NOT NULL,
    "job_key" TEXT NOT NULL,
    "google_event_id" TEXT NOT NULL,
    "google_calendar_id" TEXT NOT NULL,
    "connection_id" UUID NOT NULL,
    "etag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_PlanningGoogleLinks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "board_job_key" ON "crm_PlanningGoogleLinks"("board", "job_key");

CREATE INDEX "crm_PlanningGoogleLinks_google_event_id_idx" ON "crm_PlanningGoogleLinks"("google_event_id");

CREATE INDEX "crm_PlanningGoogleLinks_connection_id_idx" ON "crm_PlanningGoogleLinks"("connection_id");

CREATE TABLE "crm_PlanningGoogleSyncMeta" (
    "board" "crm_PlanningBoard" NOT NULL,
    "last_synced_at" TIMESTAMP(3),
    "last_error" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_PlanningGoogleSyncMeta_pkey" PRIMARY KEY ("board")
);