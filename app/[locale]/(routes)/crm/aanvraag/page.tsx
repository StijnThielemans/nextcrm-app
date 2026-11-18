import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { AanvraagForm } from "./AanvraagForm";

export default function AanvraagPage() {
  return (
    <Container
      title="Nieuwe aanvraag"
      description="Zoek eerst de klant. Daarna maak je het offertedossier. De offerte zelf komt uit de configurator van de leverancier."
    >
      <AanvraagForm />
    </Container>
  );
}
