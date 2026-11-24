import { notFound } from "next/navigation";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { requireAuthenticated } from "@/lib/authz";
import { getProjectScreen } from "@/lib/sales/projects";
import { ProjectScreen } from "./ProjectScreen";

export default async function ProjectPage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await props.params;
  const user = await requireAuthenticated();
  const project = await getProjectScreen(user, projectId);
  if (!project) notFound();
  return (
    <Container bare>
      <ProjectScreen project={project} />
    </Container>
  );
}
