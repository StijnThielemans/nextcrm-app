import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { PlanningGoogleBoardStatus } from "@/lib/sales/planning";

export function PlanningGoogleStatus({ google }: { google: PlanningGoogleBoardStatus }) {
  const tone = google.ready
    ? "border-[hsl(183_40%_38%)]/35 bg-[hsl(183_42%_96%)] text-[#08332f] dark:bg-[hsl(183_20%_16%)] dark:text-[hsl(183_42%_90%)]"
    : "border-[hsl(35_90%_55%)]/40 bg-[hsl(42_96%_93%)] text-[hsl(28_70%_22%)] dark:bg-[hsl(28_30%_14%)] dark:text-[hsl(42_90%_88%)]";

  return (
    <aside
      className={cn("tilo-frame flex shrink-0 flex-col gap-1 px-3 py-2 text-[12px] leading-snug", tone)}
      data-testid="planning-google-status"
      data-ready={google.ready ? "true" : "false"}
      data-reason={google.reason}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-semibold">Google Agenda</span>
        {google.ready ? <span className="text-[11px] opacity-80">gekoppeld</span> : <span className="text-[11px] opacity-80">stap ontbreekt</span>}
      </div>
      <p>{google.message}</p>
      {google.reason === "connection_missing" || google.reason === "connection_readonly" ? (
        <p>
          <Link href="/profile?tab=calendar" className="font-medium underline underline-offset-2">
            Profiel → Agenda
          </Link>{" "}
          om dit Google-account te verbinden.
        </p>
      ) : null}
      {google.accountEmail && google.reason !== "account_email_missing" ? (
        <p className="text-[11px] opacity-75">Account: {google.accountEmail}</p>
      ) : null}
      {google.calendarId ? <p className="text-[11px] opacity-75">Agenda-id: {google.calendarId}</p> : null}
    </aside>
  );
}