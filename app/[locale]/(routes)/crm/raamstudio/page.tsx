import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { requireAuthenticated } from "@/lib/authz";
import { RaamstudioPanel } from "./RaamstudioPanel";

export default async function RaamstudioPage() {
  await requireAuthenticated();
  return (
    <Container
      title="RaamStudio"
      description="Calculatie, alleen lezen. Open een .tc-raam met de projectgegevens, de genummerde tekeningen, de maten en de raaminfo."
    >
      <RaamstudioPanel />
    </Container>
  );
}
