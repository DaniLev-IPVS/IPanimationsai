import type { StudioUser } from "./auth";

/**
 * The Proposal Board in Notion, read and written straight from the studio.
 *
 * A lead in planning ("Pitch Booked", "Interested for info" or "Create
 * Estimate") becomes a Project
 * row (the intake cron does that). Daniel adds Idea rows under it, then sets the project to
 * "Team check / Estimate" and picks who it's for in "Assigned to". That is what
 * puts it on /studio/clients. Sending the cost estimate from there writes the
 * numbers back and moves the project to "Internal check / Create proposal".
 *
 * Needs NOTION_TOKEN: the same internal integration the Lead DB is shared
 * with, also connected to the Proposal Board (••• → Connections in Notion).
 */

const API = (process.env.NOTION_API_URL || "https://api.notion.com/v1").replace(/\/$/, "");
const NOTION_VERSION = "2025-09-03";

export const LEADS = "3f363a9c-0965-80a7-a506-000b8722a3cb"; // IP Animations Lead DB data source
export const BOARD = "d353f58d-3278-4025-9e83-c674b9e37eef"; // IP Animations Proposal Board data source

export const STATUS = {
  create: "Create",
  concept: "Concept creation",
  teamCheck: "Team check / Estimate",
  proposal: "Internal check / Create proposal",
  clientView: "Ready for client view",
  reviewed: "Client reviewed",
} as const;

export type Idea = {
  id: string;
  name: string;
  idea: string;
  why: string;
  impact: string;
  cost: number | null;
  tier: string;
  teamCost: number | null;
};

export type Project = {
  id: string;
  url: string;
  name: string;
  status: string;
  assignedTo: string[];
  needs: string;
  why: string;
  usedFor: string;
  recommended: string;
  budget: string;
  quoted: number | null;
  seconds: number | null;
  teamNotes: string;
  checkedAt: string | null;
  checkedBy: string;
  notes: string[];
  ideas: Idea[];
};

type NotionPage = { id: string; url: string; parent?: Record<string, any>; properties: Record<string, any> };

export class NotionError extends Error {}

export async function notion(path: string, method: "GET" | "POST" | "PATCH", body?: unknown) {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new NotionError("NOTION_TOKEN is not set.");
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new NotionError(`Notion ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export async function queryAll(dataSource: string, filter: unknown, sorts?: unknown): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion(`data_sources/${dataSource}/query`, "POST", {
      filter,
      ...(sorts ? { sorts } : {}),
      page_size: 100,
      ...(cursor && { start_cursor: cursor }),
    });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor && pages.length < 500);
  return pages;
}

// ── Reading Notion properties ──────────────────────────────────────────────

export const plain = (prop: any): string =>
  (prop?.title ?? prop?.rich_text ?? []).map((t: any) => t.plain_text).join("").trim();
const numberOf = (prop: any): number | null => (typeof prop?.number === "number" ? prop.number : null);
const sameId = (a: string, b: string) => a.replace(/-/g, "").toLowerCase() === b.replace(/-/g, "").toLowerCase();

/** Notion caps one text object at 2,000 characters, so long text goes in as several. */
export function richText(text: string) {
  const out: { type: "text"; text: { content: string } }[] = [];
  for (let i = 0; i < text.length && out.length < 20; i += 2000) {
    out.push({ type: "text", text: { content: text.slice(i, i + 2000) } });
  }
  return out;
}

function projectOf(page: NotionPage): Project {
  const p = page.properties;
  return {
    id: page.id,
    url: page.url,
    name: plain(p.Name) || "Untitled project",
    status: p.Status?.status?.name ?? "",
    assignedTo: (p["Assigned to"]?.multi_select ?? []).map((o: any) => String(o.name)),
    needs: plain(p["Client needs"]),
    why: plain(p["Why they need it"]),
    usedFor: plain(p["What it is for"]),
    recommended: plain(p["Recommended idea"]),
    budget: plain(p["Client budget"]),
    quoted: numberOf(p["Quoted cost"]),
    seconds: numberOf(p.Seconds),
    teamNotes: plain(p["Team notes"]),
    checkedAt: p["Team checked"]?.date?.start ?? null,
    checkedBy: plain(p["Team checked by"]),
    notes: [],
    ideas: [],
  };
}

function ideaOf(page: NotionPage): Idea {
  const p = page.properties;
  return {
    id: page.id,
    name: plain(p.Name) || "Untitled idea",
    idea: plain(p["The idea"]),
    why: plain(p["Why this idea"]),
    impact: plain(p["Potential impact"]),
    cost: numberOf(p.Cost),
    tier: p["Cost tier"]?.select?.name ?? "",
    teamCost: numberOf(p["Team cost estimate"]),
  };
}

// ── Who sees what ──────────────────────────────────────────────────────────

const firstName = (name: string) => name.trim().split(/\s+/)[0].toLowerCase();

/** Admins see every project. Everyone else sees the ones their first name is on. */
export function canSee(user: StudioUser, project: Pick<Project, "assignedTo">) {
  if (user.role === "admin") return true;
  const me = firstName(user.name);
  return project.assignedTo.some((n) => firstName(n) === me);
}

async function ideasFor(projectIds: string[]): Promise<Map<string, Idea[]>> {
  const byProject = new Map<string, Idea[]>(projectIds.map((id) => [id, []]));
  if (!projectIds.length) return byProject;
  const pages = await queryAll(BOARD, {
    and: [
      { property: "Type", select: { equals: "Idea" } },
      { or: projectIds.map((id) => ({ property: "Project", relation: { contains: id } })) },
    ],
  });
  for (const page of pages) {
    for (const rel of page.properties.Project?.relation ?? []) {
      const key = projectIds.find((id) => sameId(id, rel.id));
      if (key) byProject.get(key)!.push(ideaOf(page));
    }
  }
  // Cheapest first, so the low, mid and high options read in order.
  byProject.forEach((list) => {
    list.sort((a, b) => (a.cost ?? Infinity) - (b.cost ?? Infinity) || a.name.localeCompare(b.name));
  });
  return byProject;
}

const TEXT_BLOCKS = [
  "paragraph", "heading_1", "heading_2", "heading_3", "bulleted_list_item",
  "numbered_list_item", "to_do", "quote", "callout", "toggle",
];

/** Whatever Daniel typed in the body of the Notion page, as plain lines. */
async function pageNotes(pageId: string): Promise<string[]> {
  try {
    const res = await notion(`blocks/${pageId}/children?page_size=100`, "GET");
    return (res.results as any[])
      .filter((b) => TEXT_BLOCKS.includes(b.type))
      .map((b) => {
        const text = (b[b.type]?.rich_text ?? []).map((t: any) => t.plain_text).join("").trim();
        return text && b.type.endsWith("list_item") ? `• ${text}` : text;
      })
      .filter(Boolean);
  } catch {
    return []; // The brief still shows without the free-form notes.
  }
}

/** Projects waiting for this person's cost estimate, and the ones already sent back. */
export async function loadBoard(user: StudioUser): Promise<{ waiting: Project[]; sent: Project[] }> {
  const pages = await queryAll(
    BOARD,
    {
      and: [
        { property: "Type", select: { equals: "Project" } },
        {
          or: [
            { property: "Status", status: { equals: STATUS.teamCheck } },
            { property: "Status", status: { equals: STATUS.proposal } },
          ],
        },
      ],
    },
    [{ timestamp: "created_time", direction: "descending" }],
  );
  const mine = pages.map(projectOf).filter((p) => canSee(user, p));
  const waiting = mine.filter((p) => p.status === STATUS.teamCheck);
  const sent = mine
    .filter((p) => p.status === STATUS.proposal && p.checkedAt)
    .sort((a, b) => String(b.checkedAt).localeCompare(String(a.checkedAt)))
    .slice(0, 10);

  const [ideas, notes] = await Promise.all([
    ideasFor(waiting.map((p) => p.id)),
    Promise.all(waiting.map((p) => pageNotes(p.id))),
  ]);
  waiting.forEach((p, i) => {
    p.ideas = ideas.get(p.id) ?? [];
    p.notes = notes[i];
  });
  return { waiting, sent };
}

// ── The team's side: add an idea, send the cost estimate ───────────────────

/** The project, once it's certain this person may write to it right now. */
async function waitingProject(user: StudioUser, projectId: string): Promise<Project> {
  const page: NotionPage = await notion(`pages/${projectId}`, "GET");
  if (!sameId(String(page.parent?.data_source_id ?? ""), BOARD) || page.properties.Type?.select?.name !== "Project") {
    throw new NotionError("That project isn't on the proposal board.");
  }
  const project = projectOf(page);
  if (!canSee(user, project)) throw new NotionError("That project isn't assigned to you.");
  if (project.status !== STATUS.teamCheck) {
    throw new NotionError(`${project.name} is no longer waiting for a cost estimate.`);
  }
  return project;
}

/**
 * The team's own idea for the video, as a new Idea row under the project:
 * what it is and what it costs to make. The price to the client stays empty
 * for Daniel.
 */
export async function addIdea(
  user: StudioUser,
  projectId: string,
  idea: { title: string; what: string; cost: number | null },
): Promise<string> {
  const project = await waitingProject(user, projectId);
  const existing = (await ideasFor([project.id])).get(project.id) ?? [];
  await notion("pages", "POST", {
    parent: { type: "data_source_id", data_source_id: BOARD },
    properties: {
      Name: { title: richText(`Idea ${existing.length + 1} — ${idea.title}`) },
      Type: { select: { name: "Idea" } },
      Project: { relation: [{ id: project.id }] },
      "The idea": { rich_text: richText(idea.what) },
      ...(idea.cost !== null && { "Team cost estimate": { number: idea.cost } }),
    },
  });
  return project.name;
}

/**
 * Writes the team's numbers to Notion and hands the project back to Daniel.
 * Everything is checked again here: the page really is a project on the board,
 * it is still waiting for the team, and this person is allowed to see it.
 */
export async function sendEstimate(
  user: StudioUser,
  projectId: string,
  costs: Record<string, number>,
  notes: string,
): Promise<string> {
  const project = await waitingProject(user, projectId);
  const ideas = (await ideasFor([project.id])).get(project.id) ?? [];
  for (const idea of ideas) {
    const cost = costs[idea.id];
    if (cost === undefined) continue;
    await notion(`pages/${idea.id}`, "PATCH", { properties: { "Team cost estimate": { number: cost } } });
  }

  // The status moves last, so a failed write above leaves the project on the page to try again.
  await notion(`pages/${project.id}`, "PATCH", {
    properties: {
      Status: { status: { name: STATUS.proposal } },
      "Team notes": { rich_text: richText(notes) },
      "Team checked": { date: { start: new Date().toISOString() } },
      "Team checked by": { rich_text: richText(user.name) },
    },
  });
  return project.name;
}

// ── Intake: a lead in planning gets its project row ────────────────────────

// Planning starts when the pitch is booked or the lead asks for more. Create
// Estimate stays on the list for a lead that skips straight to it. The board's
// "Lead stage" rollup shows which of the three a project came from.
const PLANNING = ["Pitch Booked", "Interested for info", "Create Estimate"];

type NewProject = { lead: string; name: string };

/** Leads in planning that have no project on the board yet. */
export async function leadsWithoutProject(): Promise<NotionPage[]> {
  return queryAll(LEADS, {
    and: [
      { or: PLANNING.map((name) => ({ property: "Status", status: { equals: name } })) },
      { property: "Proposal", relation: { is_empty: true } },
    ],
  });
}

export async function createProjectFromLead(lead: NotionPage): Promise<NewProject> {
  const p = lead.properties;
  const name = plain(p.Name) || "Unnamed lead";
  const work = plain(p["Description of work"]);
  const comment = plain(p["Website comment"]);
  const latest = plain(p["Recent Follow-Up Notes"]);
  const purpose: string = p["It's for"]?.select?.name ?? "";
  const estimate = numberOf(p["Estimate amount"]);
  const seconds = numberOf(p.Seconds);

  const para = (label: string, text: string) => [
    { object: "block", type: "heading_3", heading_3: { rich_text: richText(label) } },
    { object: "block", type: "paragraph", paragraph: { rich_text: richText(text) } },
  ];

  await notion("pages", "POST", {
    parent: { type: "data_source_id", data_source_id: BOARD },
    properties: {
      Name: { title: richText(name) },
      Type: { select: { name: "Project" } },
      Status: { status: { name: STATUS.create } },
      Lead: { relation: [{ id: lead.id }] },
      "Client needs": { rich_text: richText(work || comment) },
      "What it is for": { rich_text: richText(purpose) },
      "Client budget": { rich_text: richText(p.Budget?.select?.name ?? "") },
      ...(estimate !== null && { "Quoted cost": { number: estimate } }),
      ...(seconds !== null && { Seconds: { number: seconds } }),
    },
    children: [
      ...(comment ? para("What they wrote on the website", comment) : []),
      ...(latest ? para("Latest from the calls", latest) : []),
    ],
  });
  return { lead: lead.id, name };
}
