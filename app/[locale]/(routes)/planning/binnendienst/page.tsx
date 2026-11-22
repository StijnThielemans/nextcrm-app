import { PlanningBoardPage } from "../PlanningBoardPage";

export default async function Page(props: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await props.searchParams;
  return <PlanningBoardPage board="binnendienst" week={week} />;
}
