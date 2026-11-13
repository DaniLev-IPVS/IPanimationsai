import { cookies } from "next/headers";
import { requireUser } from "@/lib/studio/auth";
import { LANG_COOKIE, langOf } from "@/lib/studio/i18n";
import { loadBoard } from "@/lib/studio/proposals";
import { translateBoard } from "@/lib/studio/translate";
import { addTeamIdea, setStudioLang, submitIdeaEstimate } from "../../actions";
import { ClientsView } from "./view";

// The first view of a project in a new language waits for its translation.
export const maxDuration = 300;

export default async function Clients({
  searchParams,
}: {
  searchParams: { e?: string; sent?: string; saved?: string; open?: string };
}) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const lang = langOf(cookies().get(LANG_COOKIE)?.value);

  let board: Awaited<ReturnType<typeof loadBoard>> | null = null;
  let problem = "";
  let translated = true;
  try {
    board = await loadBoard(user);
    translated = await translateBoard(board, lang);
  } catch (err) {
    console.error("[studio/clients] Notion read failed:", err);
    problem = err instanceof Error ? err.message : String(err);
  }

  return (
    <ClientsView
      isAdmin={isAdmin}
      lang={lang}
      translated={translated}
      board={board}
      problem={problem}
      error={searchParams.e}
      sent={searchParams.sent}
      saved={searchParams.saved}
      open={searchParams.open}
      estimateAction={submitIdeaEstimate}
      addAction={addTeamIdea}
      langAction={setStudioLang}
    />
  );
}
