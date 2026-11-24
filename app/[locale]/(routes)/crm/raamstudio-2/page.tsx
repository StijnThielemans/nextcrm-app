import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { requireAuthenticated } from "@/lib/authz";
import { raamstudioPlansForDossier } from "@/lib/raamstudio/dossier-plans";
import { statusLabel } from "@/lib/sales/labels";
import { listDossiers } from "@/lib/sales/service";
import { emptyProject } from "@/lib/raamstudio2/project";
import { runAutomaticAnalysis } from "@/lib/raamstudio2/run-automatic";
import { readRaamstudio2 } from "@/lib/raamstudio2/store";
import { Raamstudio2Panel } from "./Raamstudio2Panel";

function siteOf(row: {
  projectStreet: string | null;
  projectPostalCode: string | null;
  projectCity: string | null;
  projectCountry: string | null;
}): string {
  return [row.projectStreet, row.projectPostalCode, row.projectCity, row.projectCountry].filter(Boolean).join(", ");
}

export default async function Raamstudio2Page({
  searchParams,
}: {
  searchParams: Promise<{ dossier?: string }>;
}) {
  const user = await requireAuthenticated();
  const { dossier: dossierId } = await searchParams;
  const rows = await listDossiers(user);
  let selected = dossierId ? await raamstudioPlansForDossier(user, dossierId) : null;
  let loaded = selected ? await readRaamstudio2(user, selected.id) : null;
  let analysisError: string | null = null;
  const hasPlans = selected?.plans.some((plan) => plan.kind === "plan" && plan.folder === "Plannen") ?? false;
  if (selected && loaded && !loaded.project && !("error" in loaded) && !selected.locked && hasPlans) {
    const analyzed = await runAutomaticAnalysis(user, selected.id, emptyProject()).catch((error: unknown) => ({
      error: error instanceof Error ? error.message : "De automatische analyse is mislukt.",
    }));
    if ("project" in analyzed) {
      selected = await raamstudioPlansForDossier(user, selected.id);
      loaded = selected ? await readRaamstudio2(user, selected.id) : loaded;
    } else {
      analysisError = analyzed.error;
    }
  }
  const intro = "Raamstudio 2.0 werkt de plannen van het dossier uit in Raamstudio 2.0.raamstudio en Projectnotities.pdf.";
  return (
    <Container bare title="Raamstudio 2.0" description={intro}>
      <Raamstudio2Panel
        dossiers={rows.map((row) => ({
          id: row.id,
          number: row.number,
          name: row.name,
          customer: row.customer,
          projectNumber: row.executionProjectNumber,
          site: siteOf(row),
          seller: row.seller,
          status: statusLabel(row.status),
        }))}
        selected={selected}
        missing={Boolean(dossierId) && !selected}
        initial={loaded && "project" in loaded ? loaded.project : null}
        loadError={loaded && "error" in loaded ? loaded.error : analysisError}
        fileName={loaded && loaded.fileName ? loaded.fileName : null}
      />
    </Container>
  );
}
