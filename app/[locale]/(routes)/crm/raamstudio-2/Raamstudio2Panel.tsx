"use client";

import { useMemo, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { raamstudioDossierMatches } from "@/lib/raamstudio/dossier-list-search";
import type { RaamstudioDossierOpen } from "@/lib/raamstudio/dossier-plans";
import { raamstudio2Gate } from "@/lib/raamstudio/raamstudio2-gate";
import type { Rs2Project } from "@/lib/raamstudio2/project";
import { statusLabel } from "@/lib/sales/labels";
import { Raamstudio2Workspace } from "./Raamstudio2Workspace";

export type Raamstudio2DossierChoice = {
  id: string;
  number: string | null;
  name: string | null;
  customer: string | null;
  projectNumber: string | null;
  site: string;
  seller: string | null;
  status: string;
};

export function Raamstudio2Panel({
  dossiers,
  selected,
  missing,
  initial,
  loadError,
  fileName,
}: {
  dossiers: Raamstudio2DossierChoice[];
  selected: RaamstudioDossierOpen | null;
  missing: boolean;
  initial: Rs2Project | null;
  loadError: string | null;
  fileName: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const visible = useMemo(() => dossiers.filter((row) => raamstudioDossierMatches(row, query)), [dossiers, query]);
  const gate = selected ? raamstudio2Gate({ locked: selected.locked, plans: selected.plans, studio2: selected.studio2 }) : null;

  return (
    <div className={cn("mx-auto flex w-full max-w-4xl flex-col gap-4")}>
      <section className="space-y-2">
        <div className="tilo-frame px-3 py-2">
          <h2 className="flex items-center gap-2 text-base font-medium tracking-[-0.02em]">
            <span aria-hidden className="h-4 w-[3px] rounded-full bg-[hsl(var(--tilo))]" />
            Raamstudio 2.0
          </h2>
          <p className="mt-1 text-sm text-muted-foreground md:text-[13px]">
            Kies een offertedossier. Plannen komen uit de map Plannen. Het project wordt een nieuw .raamstudio-bestand.
          </p>
        </div>
        {!selected && (
          <>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Zoek nummer, klant, project, werf, verkoper of status"
              aria-label="Zoek dossier"
              className="h-11 text-base md:h-9 md:text-sm"
              data-testid="raamstudio-2-dossier-search"
            />
            <ul className="grid gap-2" data-testid="raamstudio-2-dossier-list">
              {visible.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="tilo-frame w-full px-3 py-3 text-left text-base hover:bg-accent/40 md:py-2 md:text-[13px]"
                    onClick={() => router.push(`/crm/raamstudio-2?dossier=${row.id}`)}
                    data-testid={`raamstudio-2-pick-${row.id}`}
                  >
                    <span className="font-semibold">{row.number ?? "—"}</span>
                    <span className="text-muted-foreground"> · {row.customer ?? "—"}</span>
                    <span className="mt-0.5 block text-muted-foreground">
                      {row.name ?? "—"}
                      {row.projectNumber ? ` · ${row.projectNumber}` : ""}
                      {" · "}
                      {row.site || "geen werf"}
                      {" · "}
                      {row.seller ?? "geen verkoper"}
                      {" · "}
                      {row.status}
                    </span>
                  </button>
                </li>
              ))}
              {visible.length === 0 ? <li className="text-base text-muted-foreground md:text-[13px]">Geen dossier met die tekst.</li> : null}
            </ul>
          </>
        )}
      </section>

      {missing && <p className="text-destructive">Dit dossier is niet zichtbaar of bestaat niet.</p>}

      {selected && gate && (
        <Card className="space-y-4 p-4" data-testid="raamstudio-2-dossier-panel">
          <RegistrationSummary dossier={selected} />

          <section>
            <h3 className="text-sm font-semibold">Plannen</h3>
            {gate.planFiles.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Geen plannen in de map Plannen.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-[13px]">
                {gate.planFiles.map((plan) => (
                  <li key={plan.id} data-testid={`raamstudio-2-plan-${plan.id}`}>
                    <a className="underline" href={`/api/documents/${plan.id}/file`} target="_blank" rel="noreferrer">
                      {plan.name}
                    </a>
                    <span className="text-muted-foreground"> · map Plannen</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-[12px] text-muted-foreground">Originele plannen worden niet overschreven en niet opnieuw geüpload.</p>
          </section>

          <section data-testid="raamstudio-2-calculatie">
            <h3 className="text-sm font-semibold">Calculatie</h3>
            {gate.calculatieFiles.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Geen calculatie-PDF in de map Calculatie.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-[13px]">
                {gate.calculatieFiles.map((file) => (
                  <li key={file.id}>
                    <a className="underline" href={`/api/documents/${file.id}/file`} target="_blank" rel="noreferrer">
                      {file.name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {gate.next === "resume" && gate.workFile ? (
              <p className="mt-2 text-[13px]" data-testid="raamstudio-2-workfile">
                Werkbestand {gate.workFile.name}. Verderwerken gebeurt hier, in het .raamstudio-bestand.
              </p>
            ) : null}
            {gate.next === "prepare" ? (
              <p className="mt-2 text-[13px]" data-testid="raamstudio-2-prepare">
                Nog geen .raamstudio-bestand. Hieronder bereid je een nieuw project voor. Opslaan maakt dat bestand in Calculatie.
              </p>
            ) : null}
            {gate.next === "closed" ? (
              <p className="mt-2 text-[13px]" data-testid="raamstudio-2-closed">
                Dit dossier is afgesloten. Er is geen .raamstudio-bestand en er wordt geen nieuw project aangemaakt.
              </p>
            ) : null}
          </section>

          <section className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/crm/dossiers/${selected.id}`}>Dossier openen</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => router.push("/crm/raamstudio-2")}>
              Ander dossier
            </Button>
          </section>

          {gate.next !== "closed" ? (
            <Raamstudio2Workspace
              dossierId={selected.id}
              plans={gate.planFiles}
              initial={initial}
              loadError={loadError}
              locked={selected.locked}
              fileName={fileName}
            />
          ) : null}
        </Card>
      )}
    </div>
  );
}

function RegistrationSummary({ dossier }: { dossier: RaamstudioDossierOpen }) {
  const project = [dossier.name, dossier.executionProjectNumber].filter(Boolean).join(" · ") || "—";
  return (
    <dl className="grid gap-2 text-[13px] sm:grid-cols-2" data-testid="raamstudio-2-dossier-summary">
      <div>
        <dt className="text-muted-foreground">Nummer</dt>
        <dd className="font-semibold">{dossier.number ?? dossier.id}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Klant</dt>
        <dd>{dossier.customer ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Project</dt>
        <dd>{project}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Status</dt>
        <dd>{statusLabel(dossier.status)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Werf</dt>
        <dd>{dossier.siteAddress || "—"}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Verkoper</dt>
        <dd>{dossier.seller ?? "—"}</dd>
      </div>
    </dl>
  );
}
