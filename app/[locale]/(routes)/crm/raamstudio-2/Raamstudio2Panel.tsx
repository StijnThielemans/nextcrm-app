"use client";

import { useMemo, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { raamstudioDossierMatches } from "@/lib/raamstudio/dossier-list-search";
import type { RaamstudioDossierOpen } from "@/lib/raamstudio/dossier-plans";

export type Raamstudio2DossierChoice = {
  id: string;
  number: string | null;
  name: string | null;
  customer: string | null;
};

export function Raamstudio2Panel({
  dossiers,
  selected,
  missing,
}: {
  dossiers: Raamstudio2DossierChoice[];
  selected: RaamstudioDossierOpen | null;
  missing: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const visible = useMemo(() => dossiers.filter((row) => raamstudioDossierMatches(row, query)), [dossiers, query]);
  const workFile = selected?.plans.find((plan) => plan.kind === "tc-raam") ?? null;
  const planPdfs = selected?.plans.filter((plan) => plan.kind === "plan") ?? [];

  return (
    <div className={cn("mx-auto flex w-full max-w-4xl flex-col gap-6")}>
      <section className="space-y-2">
        <div className="tilo-frame px-3 py-2">
          <h2 className="flex items-center gap-2 text-base font-medium tracking-[-0.02em]">
            <span aria-hidden className="h-4 w-[3px] rounded-full bg-[hsl(var(--tilo))]" />
            Raamstudio 2.0
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Kies een offertedossier. Plannen komen uit de bestaande mappen op het dossier. Het originele RaamStudio blijft beschikbaar.
          </p>
        </div>
        {!selected && (
          <>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Zoek dossiernummer, klant …"
              aria-label="Zoek dossier"
              className="h-9"
              data-testid="raamstudio-2-dossier-search"
            />
            <ul className="grid gap-2" data-testid="raamstudio-2-dossier-list">
              {visible.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="tilo-frame w-full px-3 py-2 text-left text-[13px] hover:bg-accent/40"
                    onClick={() => router.push(`/crm/raamstudio-2?dossier=${row.id}`)}
                    data-testid={`raamstudio-2-pick-${row.id}`}
                  >
                    <span className="font-semibold">{row.number ?? "—"}</span>
                    <span className="text-muted-foreground"> · {row.customer ?? row.name ?? "—"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {missing && <p className="text-destructive">Dit dossier is niet zichtbaar of bestaat niet.</p>}

      {selected && (
        <Card className="space-y-4 p-4" data-testid="raamstudio-2-dossier-panel">
          <RegistrationSummary dossier={selected} />
          <section>
            <h3 className="text-sm font-semibold">Plannen op dit dossier</h3>
            {planPdfs.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Geen plannen in de map Plannen of Calculatie.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-[13px]">
                {planPdfs.map((plan) => (
                  <li key={plan.id} data-testid={`raamstudio-2-plan-${plan.id}`}>
                    <span className="font-medium">{plan.folder}:</span> {plan.name}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="flex flex-wrap gap-2">
            {workFile ? (
              <Button asChild size="sm" data-testid="raamstudio-2-resume">
                <Link href={`/crm/raamstudio?dossier=${selected.id}`}>Hervat werkbestand ({workFile.name})</Link>
              </Button>
            ) : (
              <Button asChild size="sm" data-testid="raamstudio-2-start-calc">
                <Link href={`/crm/raamstudio?dossier=${selected.id}`}>Calculatie controleren</Link>
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => router.push("/crm/raamstudio-2")}>
              Ander dossier
            </Button>
          </section>
        </Card>
      )}
    </div>
  );
}

function RegistrationSummary({ dossier }: { dossier: RaamstudioDossierOpen }) {
  return (
    <dl className="grid gap-1 text-[13px] sm:grid-cols-2" data-testid="raamstudio-2-dossier-summary">
      <div>
        <dt className="text-muted-foreground">Dossier</dt>
        <dd className="font-semibold">{dossier.number ?? dossier.id}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Klant</dt>
        <dd>{dossier.customer ?? "—"}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-muted-foreground">Werf</dt>
        <dd>{dossier.siteAddress || "—"}</dd>
      </div>
    </dl>
  );
}