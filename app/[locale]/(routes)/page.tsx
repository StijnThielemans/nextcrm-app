import Container from "./components/ui/Container";
import { SalesDashboard } from "./crm/sales/SalesDashboard";

export default function HomePage() {
  return (
    <Container
      title="Verkoop"
      description="Aanvraag, offerte en opvolging. Gewonnen sluit het verkooppad."
    >
      <SalesDashboard />
    </Container>
  );
}
