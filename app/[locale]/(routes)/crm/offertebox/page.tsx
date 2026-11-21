import { getTranslations } from "next-intl/server";
import { requireAuthenticated } from "@/lib/authz";
import { listOffertebox } from "@/lib/sales/offertebox";
import { OfferteboxBoard } from "./OfferteboxBoard";

export default async function OfferteboxPage() {
  const user = await requireAuthenticated();
  const t = await getTranslations("Sales");
  const view = await listOffertebox(user);
  const description = t("offertebox.description");
  return (
    <div className="flex flex-col gap-2 lg:h-[calc(100dvh-11.5rem)] lg:min-h-0 lg:overflow-hidden">
      <header
        data-testid="offertebox-heading"
        className="flex shrink-0 items-center gap-3 rounded-[0.9rem] border border-[hsl(215_16%_76%)] bg-white px-3 py-1.5 dark:border-[hsl(210_8%_26%)] dark:bg-card"
      >
        <h1 className="flex shrink-0 items-center gap-2 text-base font-medium leading-none tracking-tight">
          <span aria-hidden className="h-4 w-[3px] shrink-0 rounded-full bg-[hsl(var(--tilo))]" />
          {t("offertebox.title")}
        </h1>
        <p className="min-w-0 truncate text-xs leading-tight text-muted-foreground" title={description}>
          {description}
        </p>
      </header>
      <OfferteboxBoard view={view} />
    </div>
  );
}
