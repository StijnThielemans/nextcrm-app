"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DossierPlanFile } from "@/lib/raamstudio/dossier-plans";
import {
  RaamstudioFileError,
  readRaamstudioProject,
  type NumberedPosition,
  type RaamstudioProject,
} from "@/lib/raamstudio/read-project";

export type RaamstudioDossierChoice = {
  id: string;
  number: string | null;
  name: string | null;
  customer: string | null;
};

export type RaamstudioSelected = {
  id: string;
  number: string | null;
  name: string | null;
  plans: DossierPlanFile[];
};

export function RaamstudioPanel({
  dossiers,
  selected,
  missing,
}: {
  dossiers: RaamstudioDossierChoice[];
  selected: RaamstudioSelected | null;
  missing: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [project, setProject] = useState<RaamstudioProject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{
    id: string;
    fileName: string;
    project: RaamstudioProject | null;
    error: string | null;
  } | null>(null);
  const tcRaam = selected?.plans.find((plan) => plan.kind === "tc-raam") ?? null;
  const dossierView = loaded && tcRaam && loaded.id === tcRaam.id ? loaded : null;

  const tcRaamId = tcRaam?.id ?? null;
  const tcRaamName = tcRaam?.name ?? null;

  useEffect(() => {
    if (!tcRaamId || !tcRaamName) return;
    const controller = new AbortController();
    const id = tcRaamId;
    const fileName = tcRaamName;
    void (async () => {
      try {
        const response = await fetch(`/api/documents/${id}/file`, { signal: controller.signal });
        if (!response.ok) throw new RaamstudioFileError("Dit .tc-raam kon niet worden gelezen.");
        const view = await readRaamstudioProject(new Uint8Array(await response.arrayBuffer()));
        if (!controller.signal.aborted) setLoaded({ id, fileName, project: view, error: null });
      } catch (caught) {
        if (controller.signal.aborted) return;
        setLoaded({
          id,
          fileName,
          project: null,
          error: caught instanceof RaamstudioFileError ? caught.message : "Dit .tc-raam kon niet worden gelezen.",
        });
      }
    })();
    return () => controller.abort();
  }, [tcRaamId, tcRaamName]);

  async function openFile(file: File) {
    setError(null);
    try {
      const projectView = await readRaamstudioProject(new Uint8Array(await file.arrayBuffer()));
      setFileName(file.name);
      setProject(projectView);
    } catch (caught) {
      setFileName(file.name);
      setProject(null);
      setError(caught instanceof RaamstudioFileError ? caught.message : "Dit bestand kon niet worden gelezen.");
    }
  }

  const hasTcRaam = selected?.plans.some((plan) => plan.kind === "tc-raam") ?? false;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <section>
        <h3 className="text-sm font-medium">Offertedossiers</h3>
        {dossiers.length ? (
          <ul className="mt-3 divide-y divide-black/[0.06] rounded-xl border border-black/[0.06] bg-card" data-testid="raamstudio-dossiers">
            {dossiers.map((dossier) => {
              const active = selected?.id === dossier.id;
              return (
                <li key={dossier.id}>
                  <Link
                    href={`/crm/raamstudio?dossier=${dossier.id}`}
                    className={cn(
                      "block px-4 py-3 text-sm hover:bg-accent",
                      active && "border-l-[3px] border-l-[hsl(var(--tilo))] bg-accent",
                    )}
                    data-testid={active ? "raamstudio-dossier-selected" : undefined}
                  >
                    <span className="font-medium">{dossier.number ?? "Zonder nummer"}</span>
                    <span className="text-muted-foreground"> · {dossier.name ?? "Zonder projectbeschrijving"}</span>
                    {dossier.customer ? <span className="mt-1 block text-xs text-muted-foreground">{dossier.customer}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Nog geen offertedossiers.</p>
        )}
      </section>

      {missing ? <p className="text-sm text-muted-foreground">Dit dossier is niet gevonden.</p> : null}

      {selected ? (
        <section>
          <h3 className="text-sm font-medium">Plannen</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {[selected.number, selected.name].filter(Boolean).join(" · ")}
          </p>
          {selected.plans.length ? (
            <ul className="mt-3 space-y-2 text-sm" data-testid="raamstudio-plans">
              {selected.plans.map((plan) => (
                <li key={plan.id} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    {plan.folder} · {plan.name}
                  </span>
                  <a
                    className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                    href={`/api/documents/${plan.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Openen
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Geen plannen op dit dossier.</p>
          )}
          {selected.plans.length && !hasTcRaam ? (
            <p className="mt-3 text-sm text-muted-foreground" data-testid="raamstudio-plan-note">
              De raaminfo-kaart komt alleen uit een .tc-raam. Deze plannen staan al op het dossier. Er worden geen posities uit een PDF gelezen.
            </p>
          ) : null}
          {dossierView?.error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">{dossierView.error}</p>
          ) : null}
          {dossierView?.project ? <div className="mt-4"><ProjectCard fileName={dossierView.fileName} project={dossierView.project} /></div> : null}
        </section>
      ) : null}

      <div
        data-testid="raamstudio-drop"
        className={cn(
          "rounded-xl border border-dashed bg-card px-6 py-8 text-center",
          over ? "border-[hsl(var(--tilo))]" : "border-black/15",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const file = event.dataTransfer.files[0];
          if (file) void openFile(file);
        }}
      >
        <p className="text-sm">Of open een los .tc-raam.</p>
        <p className="mt-1 text-xs text-muted-foreground">Alleen lezen. Er wordt niets in een dossier opgeslagen.</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => inputRef.current?.click()}>
          Bestand kiezen
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".tc-raam"
          className="sr-only"
          data-testid="raamstudio-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void openFile(file);
            event.target.value = "";
          }}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive" data-testid="raamstudio-error">
          {error}
        </p>
      ) : null}

      {project ? <ProjectCard fileName={fileName} project={project} /> : null}
    </div>
  );
}

function ProjectCard({ fileName, project }: { fileName: string | null; project: RaamstudioProject }) {
  const columns = positionColumns(project.positions);
  return (
    <Card className="border-l-[3px] border-l-[hsl(var(--tilo))]" data-testid="raamstudio-card">
      <div className="space-y-8 p-6">
        {fileName ? <p className="text-xs text-muted-foreground">{fileName}</p> : null}

        <section>
          <h3 className="text-sm font-medium">Projectgegevens</h3>
          {project.projectType || project.details.length ? (
            <dl className="mt-3 grid gap-4 sm:grid-cols-2">
              {project.projectType ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Projecttype</dt>
                  <dd className="mt-1 text-sm" data-testid="raamstudio-project-type">{project.projectType}</dd>
                </div>
              ) : null}
              {project.details.map((detail) => (
                <div key={detail.label}>
                  <dt className="text-xs text-muted-foreground">{detail.label}</dt>
                  <dd
                    className="mt-1 text-sm"
                    data-testid={detail.label === "Werfadres" ? "raamstudio-address" : undefined}
                  >
                    {detail.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Geen projectgegevens ingevuld.</p>
          )}
        </section>

        {project.drawings.length ? (
          <section>
            <h3 className="text-sm font-medium">Tekeningen</h3>
            <ul className="mt-3 space-y-1 text-sm">
              {project.drawings.map((drawing) => (
                <li key={`${drawing.kind ?? ""}-${drawing.name}`}>
                  {drawing.kind ? `${drawing.name} · ${drawing.kind}` : drawing.name}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h3 className="text-sm font-medium">Genummerde posities</h3>
          {project.positions.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm" data-testid="raamstudio-positions">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    {columns.map((column) => (
                      <th key={column.key} className="py-2 pr-4 font-medium">{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {project.positions.map((position) => (
                    <tr key={position.number} className="border-b border-black/[0.06] align-top">
                      {columns.map((column) => (
                        <td key={column.key} className="py-2 pr-4">
                          {column.key === "number" ? (
                            <div>
                              <div>{position.number}</div>
                              {position.places.length || position.drawing ? (
                                <div className="mt-1 text-xs text-muted-foreground break-words">
                                  {[position.places.join(" · "), position.drawing].filter(Boolean).join(" · ")}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            position[column.key] ?? ""
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Geen genummerde posities in dit bestand.</p>
          )}
        </section>

        {project.sizes.length ? (
          <section>
            <h3 className="text-sm font-medium">Maten</h3>
            <ul className="mt-3 space-y-1 text-sm" data-testid="raamstudio-sizes">
              {project.sizes.map((size, index) => (
                <li key={`${size.drawing ?? ""}-${size.valueMm}-${index}`}>
                  {[size.orientation, `${size.valueMm} mm`, size.drawing].filter(Boolean).join(" · ")}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h3 className="text-sm font-medium">Raaminfo</h3>
          {project.raaminfo.length ? (
            <ul className="mt-3 space-y-2 text-sm" data-testid="raamstudio-raaminfo">
              {project.raaminfo.map((item, index) => (
                <li key={`${item.text}-${item.drawing ?? ""}-${index}`}>
                  <div>{[item.number, item.category, item.text].filter(Boolean).join(" · ")}</div>
                  {item.drawing ? <div className="text-xs text-muted-foreground break-words">{item.drawing}</div> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Geen raaminfo in dit bestand.</p>
          )}
        </section>
      </div>
    </Card>
  );
}

function positionColumns(positions: NumberedPosition[]) {
  const columns: { key: "number" | "windowType" | "widthMm" | "heightMm" | "note"; label: string }[] = [
    { key: "number", label: "Raamnummer" },
  ];
  if (positions.some((position) => position.windowType)) columns.push({ key: "windowType", label: "Type raam" });
  if (positions.some((position) => position.widthMm)) columns.push({ key: "widthMm", label: "Breedte (mm)" });
  if (positions.some((position) => position.heightMm)) columns.push({ key: "heightMm", label: "Hoogte (mm)" });
  if (positions.some((position) => position.note)) columns.push({ key: "note", label: "Opmerking" });
  return columns;
}
