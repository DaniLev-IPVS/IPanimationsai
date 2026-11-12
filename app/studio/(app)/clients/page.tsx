import { requireUser } from "@/lib/studio/auth";
import { loadBoard } from "@/lib/studio/proposals";
import { addTeamIdea, submitIdeaEstimate } from "../../actions";
import { ClientsView } from "./view";

export default async function Clients({ searchParams }: { searchParams: { e?: string; sent?: string; saved?: string; open?: string } }) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  let board: Awaited<ReturnType<typeof loadBoard>> | null = null;
  let problem = "";
  try {
    board = await loadBoard(user);
  } catch (err) {
    console.error("[studio/clients] Notion read failed:", err);
    problem = err instanceof Error ? err.message : String(err);
  }

  return (
    <ClientsView
      isAdmin={isAdmin}
      board={board}
      problem={problem}
      error={searchParams.e}
      sent={searchParams.sent}
      saved={searchParams.saved}
      open={searchParams.open}
      estimateAction={submitIdeaEstimate}
      addAction={addTeamIdea}
    />
  );
}
