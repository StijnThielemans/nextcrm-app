import { PlanningBoardPage } from "../PlanningBoardPage";

export default async function Page(props: { searchParams: Promise<{ week?: string; view?: string }> }) {
  const { week, view } = await props.searchParams;
  return <PlanningBoardPage board="dienst-na-verkoop" week={week} view={view} />;
}
