import { inngest } from "@/inngest/client";
import { pushPlanningJobToGoogle, recordPlanningGoogleSyncMeta } from "@/lib/sales/planning-google";
import { boardForChassis, boardForGlass, jobId, parseJobId, type PlanningBoardId } from "@/lib/sales/planning";
import { prismadb } from "@/lib/prisma";

export const planningGooglePush = inngest.createFunction(
  {
    id: "planning-google-push",
    name: "Planning: push job to Google Calendar",
    retries: 3,
    triggers: [{ event: "planning/google.push" }],
  },
  async ({ event }) => {
    const { board, jobKey } = event.data as { board: PlanningBoardId; jobKey: string };
    const parsed = parseJobId(jobKey);
    if (!parsed) return { pushed: false, reason: "invalid-job" };

    if (parsed.kind === "chassis" || parsed.kind === "glass" || parsed.kind === "office") {
      const row = await prismadb.crm_Opportunities.findFirst({
        where: { id: parsed.id, is_dossier: true },
        select: {
          id: true,
          execution_project_number: true,
          projectleiding_action: true,
          chassis_work_days: true,
          glass_work_days: true,
          chassis_plan_start: true,
          chassis_plan_end: true,
          glass_plan_start: true,
          glass_plan_end: true,
          office_plan_start: true,
          office_plan_end: true,
          project_street: true,
          project_postal_code: true,
          project_city: true,
          project_country: true,
          assigned_account: { select: { name: true } },
        },
      });
      if (!row?.execution_project_number) return { pushed: false, reason: "no-project" };
      const { jobsFromProject } = await import("@/lib/sales/planning");
      const drafts = jobsFromProject({
        id: row.id,
        projectNumber: row.execution_project_number,
        customer: row.assigned_account?.name ?? null,
        address: null,
        projectleidingAction: row.projectleiding_action,
        chassisWorkDays: row.chassis_work_days,
        glassWorkDays: row.glass_work_days,
        chassisStart: row.chassis_plan_start?.toISOString().slice(0, 10) ?? null,
        chassisEnd: row.chassis_plan_end?.toISOString().slice(0, 10) ?? null,
        glassStart: row.glass_plan_start?.toISOString().slice(0, 10) ?? null,
        glassEnd: row.glass_plan_end?.toISOString().slice(0, 10) ?? null,
        officeStart: row.office_plan_start?.toISOString().slice(0, 10) ?? null,
        officeEnd: row.office_plan_end?.toISOString().slice(0, 10) ?? null,
        place: row.project_city,
      });
      const job = drafts.find((item) => item.id === jobKey);
      if (!job) return { pushed: false, reason: "job-gone" };
      const targetBoard =
        parsed.kind === "chassis" ? boardForChassis() : parsed.kind === "glass" ? boardForGlass() : "binnendienst";
      const assignments =
        targetBoard === "buitendienst"
          ? await prismadb.crm_PlanningAssignments.findMany({
              where: { opportunity_id: row.id, kind: parsed.kind === "chassis" ? "CHASSIS" : "GLASS" },
              select: { id: true, resource: true, day: true, kind: true, opportunity_id: true },
            }).then((rows) =>
              rows.flatMap((r) => {
                const day = r.day.toISOString().slice(0, 10);
                const kind = parsed.kind === "chassis" ? "chassis" : "glass";
                return [{ id: r.id, resource: r.resource, day, jobId: jobId(kind, row.id) }];
              }),
            )
          : [];
      const { assignJobColors } = await import("@/lib/sales/planning");
      const color = assignJobColors([job]).get(job.id)!;
      await pushPlanningJobToGoogle(targetBoard, { ...job, color }, assignments);
      await recordPlanningGoogleSyncMeta(targetBoard, null);
      return { pushed: true, board: targetBoard };
    }

    if (parsed.kind === "manual") {
      const item = await prismadb.crm_PlanningItems.findFirst({
        where: { id: parsed.id, deletedAt: null },
        select: {
          id: true,
          text: true,
          plan_start: true,
          plan_end: true,
          opportunity: {
            select: {
              execution_project_number: true,
              project_city: true,
              assigned_account: { select: { name: true } },
            },
          },
        },
      });
      if (!item) return { pushed: false, reason: "manual-gone" };
      const start = item.plan_start?.toISOString().slice(0, 10) ?? null;
      const end = item.plan_end?.toISOString().slice(0, 10) ?? null;
      const { spanDays, assignJobColors } = await import("@/lib/sales/planning");
      const days = start && end ? spanDays(start, end) : [];
      const draft = {
        id: jobKey,
        kind: "manual" as const,
        board: "binnendienst" as const,
        projectId: null,
        projectNumber: item.opportunity?.execution_project_number ?? null,
        customer: item.opportunity?.assigned_account?.name ?? null,
        address: null,
        text: item.text,
        workDays: 1,
        place: item.opportunity?.project_city ?? null,
        start,
        end,
        days,
      };
      const color = assignJobColors([draft]).get(draft.id)!;
      await pushPlanningJobToGoogle("binnendienst", { ...draft, color }, []);
      await recordPlanningGoogleSyncMeta("binnendienst", null);
      return { pushed: true, board: "binnendienst" };
    }

    return { pushed: false, reason: "unsupported-kind" };
  },
);