import { usd } from "@/lib/studio/filters";
import type { Idea, Project } from "@/lib/studio/proposals";
import { SubmitButton } from "../../ui";

const TIER_CLASS: Record<string, string> = {
  "Low-cost option": "st-chip-low",
  "Mid-cost option": "st-chip-mid",
  "High-cost option": "st-chip-high",
};

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "–";

function Brief({ project }: { project: Project }) {
  const rows: [string, string][] = [
    ["What the client needs", project.needs],
    ["Why they need it", project.why],
    ["What it's for", project.usedFor],
    ["Recommended idea", project.recommended],
    ["Client budget", project.budget],
    ["Quoted cost", project.quoted === null ? "" : usd(project.quoted)],
    ["Length", project.seconds === null ? "" : `${project.seconds} seconds`],
  ];
  const filled = rows.filter(([, value]) => value);
  if (!filled.length && !project.notes.length) {
    return <p className="st-muted">No brief has been written for this project yet.</p>;
  }
  return (
    <>
      <dl className="st-brief">
        {filled.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {project.notes.length ? (
        <div className="st-brief-notes">
          <h3 className="st-subhead">Notes</h3>
          {project.notes.map((line, i) => <p key={i}>{line}</p>)}
        </div>
      ) : null}
    </>
  );
}

function IdeaCard({ idea, index, form }: { idea: Idea; index: number; form: string }) {
  const parts: [string, string][] = [
    ["The idea", idea.idea],
    ["Why this idea", idea.why],
    ["Potential impact", idea.impact],
  ];
  return (
    <li className="st-idea">
      <div className="st-idea-head">
        <h3 className="st-subhead">{idea.name || `Idea ${index + 1}`}</h3>
        {idea.tier ? <span className={`st-chip ${TIER_CLASS[idea.tier] ?? ""}`}>{idea.tier}</span> : null}
        <span className="st-idea-cost">
          {idea.cost === null ? <span className="st-muted st-small">No client price yet</span> : usd(idea.cost)}
        </span>
      </div>
      <dl className="st-brief">
        {parts.filter(([, value]) => value).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <label className="st-idea-estimate">
        Your cost to make it (USD)
        <input
          form={form}
          name={`cost:${idea.id}`}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          defaultValue={idea.teamCost ?? ""}
          placeholder="0.00"
        />
      </label>
    </li>
  );
}

export function ClientsView({
  isAdmin,
  board,
  problem,
  error,
  sent,
  added,
  action,
  addAction,
}: {
  isAdmin: boolean;
  board: { waiting: Project[]; sent: Project[] } | null;
  problem: string;
  error?: string;
  sent?: string;
  added?: string;
  action: (fd: FormData) => Promise<void>;
  addAction: (fd: FormData) => Promise<void>;
}) {
  return (
    <>
      <div className="st-head">
        <div>
          <h1>Potential clients</h1>
          <p className="st-muted">
            {isAdmin
              ? "Every project set to Team check / Estimate in Notion, whoever it's assigned to."
              : "Projects Daniel sent you. Read what the client wants, add your idea for the video and what it costs to make, and send it back."}
          </p>
        </div>
      </div>

      {error ? <p className="st-error" role="alert">{error}</p> : null}
      {sent ? (
        <p className="st-note" role="status">Cost estimate sent for {sent}. Daniel can build the proposal now.</p>
      ) : null}
      {added ? <p className="st-note" role="status">Idea added to {added}.</p> : null}
      {problem ? (
        <p className="st-error" role="alert">
          Couldn&apos;t read the proposal board from Notion.{isAdmin ? ` ${problem}` : " Tell Daniel."}
        </p>
      ) : null}

      {board && !board.waiting.length ? (
        <section className="st-card st-panel">
          <p className="st-empty">Nothing is waiting for a cost estimate.</p>
        </section>
      ) : null}

      {board?.waiting.map((project) => (
        <section key={project.id} className="st-card st-panel">
          <div className="st-panel-head">
            <h2>{project.name}</h2>
            <span className="st-client-meta">
              {project.assignedTo.length ? (
                <span className="st-muted st-small">For {project.assignedTo.join(", ")}</span>
              ) : (
                <span className="st-chip st-chip-high">Not assigned to anyone</span>
              )}
              {isAdmin ? <a className="st-small" href={project.url} target="_blank" rel="noreferrer">Open in Notion</a> : null}
            </span>
          </div>
          <Brief project={project} />

          <div className="st-estimate">
            {project.ideas.length ? (
              <ol className="st-ideas">
                {project.ideas.map((idea, i) => (
                  <IdeaCard key={idea.id} idea={idea} index={i} form={`estimate-${project.id}`} />
                ))}
              </ol>
            ) : (
              <p className="st-muted">No ideas on this project yet. Add yours below.</p>
            )}

            {/* Keyed by the idea count so the fields clear once an idea is added. */}
            <details key={project.ideas.length} className="st-add-idea" open={!project.ideas.length}>
              <summary>Add an idea</summary>
              <form action={addAction}>
                <input type="hidden" name="project" value={project.id} />
                <label>
                  Short name
                  <input name="title" type="text" required maxLength={120} placeholder="Mascot opens the shop" />
                </label>
                <label>
                  What happens in the video
                  <textarea
                    name="what"
                    rows={4}
                    required
                    maxLength={6000}
                    placeholder="What we see, how long it runs, the style, and how we would make it."
                  />
                </label>
                <label className="st-idea-estimate">
                  Your cost to make it (USD)
                  <input name="cost" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" />
                </label>
                <div className="st-estimate-foot">
                  <SubmitButton className="st-btn" pendingLabel="Adding…">Add idea</SubmitButton>
                  <span className="st-muted st-small">Add ideas first: adding one reloads the page.</span>
                </div>
              </form>
            </details>
          </div>

          <form id={`estimate-${project.id}`} action={action} className="st-estimate">
            <input type="hidden" name="project" value={project.id} />
            <label>
              Notes for Daniel
              <textarea
                name="notes"
                rows={3}
                maxLength={4000}
                defaultValue={project.teamNotes}
                placeholder="Anything that changes the price or the timing."
              />
            </label>
            <div className="st-estimate-foot">
              <SubmitButton className="st-btn st-btn-primary" pendingLabel="Sending…">Send cost estimate</SubmitButton>
              <span className="st-muted st-small">Tells Daniel it&apos;s ready and takes the project off this page.</span>
            </div>
          </form>
        </section>
      ))}

      {board?.sent.length ? (
        <section className="st-card st-panel">
          <h2>Sent back</h2>
          <div className="st-table-wrap">
            <table className="st-table">
              <thead><tr><th>Project</th><th>Sent</th><th>By</th><th>Notes</th></tr></thead>
              <tbody>
                {board.sent.map((p) => (
                  <tr key={p.id}>
                    <td>{isAdmin ? <a href={p.url} target="_blank" rel="noreferrer">{p.name}</a> : p.name}</td>
                    <td className="st-nowrap">{day(p.checkedAt)}</td>
                    <td>{p.checkedBy || "–"}</td>
                    <td>{p.teamNotes || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
