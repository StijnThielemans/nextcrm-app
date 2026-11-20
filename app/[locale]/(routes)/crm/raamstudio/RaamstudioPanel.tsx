"use client";

import { useMemo, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { raamstudioDossierMatches } from "@/lib/raamstudio/dossier-list-search";
import type { RaamstudioDossierOpen } from "@/lib/raamstudio/dossier-plans";
import { RaamstudioWorkspace } from "./RaamstudioWorkspace";
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

export function RaamstudioPanel({
  dossiers,
  selected,
  missing,
  intro,
}: {
  dossiers: RaamstudioDossierChoice[];
  selected: RaamstudioDossierOpen | null;
  missing: boolean;
  intro?: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [over, setOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [project, setProject] = useState<RaamstudioProject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirtyFor, setDirtyFor] = useState<string | null>(null);
  const dirty = dirtyFor === selected?.id;

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

  const visible = useMemo(
    () => dossiers.filter((dossier) => raamstudioDossierMatches(dossier, query)),
    [dossiers, query],
  );

  return (
    <div className={cn("mx-auto flex w-full flex-col gap-6", selected ? "max-w-none" : "max-w-4xl")}>
      {selected ? (
        <div className="flex flex-wrap items-center gap-3" data-testid="raamstudio-dossier-bar">
          <Link
            href={`/crm/dossiers/${selected.id}`}
            data-testid="raamstudio-dossier-link"
            className="text-sm underline decoration-[hsl(var(--tilo))] underline-offset-4"
            onClick={(event) => {
              if (!dirty) return;
              const stay = !window.confirm("De wijzigingen in RaamStudio zijn nog niet opgeslagen. Toch naar het dossier gaan?");
              if (stay) event.preventDefault();
            }}
          >
            <span className="font-medium" data-testid="raamstudio-dossier-selected">{selected.number ?? "Zonder nummer"}</span>
            <span className="text-muted-foreground"> · {selected.name ?? "Zonder projectbeschrijving"}</span>
          </Link>
          <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            Ander dossier
            <select
              className="h-9 max-w-xs rounded-lg border border-input bg-card px-2 text-sm text-foreground"
              value={selected.id}
              aria-label="Ander dossier"
              data-testid="raamstudio-dossier-switch"
              onChange={(event) => {
                const next = event.target.value;
                if (next === selected.id) return;
                if (dirty && !window.confirm("De wijzigingen in RaamStudio zijn nog niet opgeslagen. Toch een ander dossier openen?")) return;
                router.push(`/crm/raamstudio?dossier=${next}`);
              }}
            >
              {dossiers.map((dossier) => (
                <option key={dossier.id} value={dossier.id}>
                  {dossier.number ?? "Zonder nummer"} · {dossier.name ?? "Zonder projectbeschrijving"}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
      <section className="space-y-2">
        <div className="tilo-frame px-3 py-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            <h2 className="flex shrink-0 items-center gap-2 text-base font-medium leading-none tracking-[-0.02em]">
              <span aria-hidden className="h-4 w-[3px] shrink-0 rounded-full bg-[hsl(var(--tilo))]" />
              RaamStudio
            </h2>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Zoeken …"
              aria-label="Zoeken"
              className="h-8 w-52 rounded-full bg-[hsl(var(--canvas))] px-3 text-xs sm:w-64"
              data-testid="raamstudio-dossier-search"
            />
          </div>
        </div>
        {intro ? <p className="px-1 text-sm text-muted-foreground">{intro}</p> : null}
        {dossiers.length ? (
          visible.length ? (
            <ul className="divide-y divide-black/[0.06] rounded-xl border border-black/[0.06] bg-card" data-testid="raamstudio-dossiers">
              {visible.map((dossier) => (
                <li key={dossier.id}>
                  <Link
                    href={`/crm/raamstudio?dossier=${dossier.id}`}
                    className="block px-4 py-3 text-sm hover:bg-accent"
                  >
                    <span className="font-medium">{dossier.number ?? "Zonder nummer"}</span>
                    <span className="text-muted-foreground"> · {dossier.name ?? "Zonder projectbeschrijving"}</span>
                    {dossier.customer ? <span className="mt-1 block text-xs text-muted-foreground">{dossier.customer}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Geen offertedossier gevonden.</p>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Nog geen offertedossiers.</p>
        )}
      </section>
      )}

      {missing ? <p className="text-sm text-muted-foreground">Dit dossier is niet gevonden.</p> : null}

      {selected ? (
        <RaamstudioWorkspace
          key={selected.id}
          dossier={selected}
          onDirtyChange={(value) => setDirtyFor(value ? selected.id : null)}
        />
      ) : null}

      {selected ? null : (
      <>
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
      </>
      )}
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
