import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { requireAuthenticated } from "@/lib/authz";
import { listProjects } from "@/lib/sales/projects";
import { ProjectList } from "./ProjectList";

export default async function ProjectenPage() {
  const user = await requireAuthenticated();
  const rows = await listProjects(user);
  return (
    <Container bare>
      <ProjectList rows={rows} />
    </Container>
  );
}
