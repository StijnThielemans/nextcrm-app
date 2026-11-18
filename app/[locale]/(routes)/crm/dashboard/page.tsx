import Container from "../../components/ui/Container";
import { SalesDashboard } from "../sales/SalesDashboard";

export default function CrmDashboardPage() {
  return (
    <Container
      title="Verkoop"
      description="Aantallen en waarden van offertedossiers. De waarde is de laatst verstuurde versie, excl. btw."
    >
      <SalesDashboard />
    </Container>
  );
}
