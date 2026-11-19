import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { listActiveTaxRates, previewDossierNumber } from "@/lib/sales/service";
import { AanvraagForm } from "./AanvraagForm";

export default async function AanvraagPage() {
  const [projectNumber, taxRates] = await Promise.all([
    previewDossierNumber(),
    listActiveTaxRates(),
  ]);
  return (
    <Container
      title="Nieuwe aanvraag"
      description="Het projectnummer wordt automatisch toegekend. Zoek de klant, of maak er een nieuwe."
    >
      <AanvraagForm projectNumber={projectNumber ?? "Automatisch"} taxRates={taxRates} />
    </Container>
  );
}
