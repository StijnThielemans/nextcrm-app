import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { requireAuthenticated } from "@/lib/authz";
import { raamstudioPlansForDossier } from "@/lib/raamstudio/dossier-plans";
import { statusLabel } from "@/lib/sales/labels";
import { listDossiers } from "@/lib/sales/service";
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
  const selected = dossierId ? await raamstudioPlansForDossier(user, dossierId) : null;
  const loaded = selected ? await readRaamstudio2(user, selected.id) : null;
  const intro = "Raamstudio 2.0 — eigen projectbestand .rs2 op de plannen van het dossier.";
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
        loadError={loaded && "error" in loaded ? loaded.error : null}
        fileName={loaded && loaded.fileName ? loaded.fileName : null}
      />
    </Container>
  );
}
