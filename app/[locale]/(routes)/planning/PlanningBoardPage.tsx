import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { requireAuthenticated } from "@/lib/authz";
import { loadPlanningBoard } from "@/lib/sales/planning-data";
import type { PlanningBoardId } from "@/lib/sales/planning";
import { PlanningCalendar } from "./PlanningCalendar";

export async function PlanningBoardPage({
  board,
  week,
  view,
}: {
  board: PlanningBoardId;
  week?: string;
  view?: string;
}) {
  const user = await requireAuthenticated();
  const data = await loadPlanningBoard(user, board, week, new Date(), view);
  return (
    <Container bare>
      <PlanningCalendar data={data} />
    </Container>
  );
}
