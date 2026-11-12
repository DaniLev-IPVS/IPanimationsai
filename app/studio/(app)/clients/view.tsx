import { usd } from "@/lib/studio/filters";
import { isEstimated, type Idea, type Project } from "@/lib/studio/proposals";
import { SubmitButton } from "../../ui";

type Action = (fd: FormData) => Promise<void>;

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "–";
const money = (n: number) => usd(n).replace(/\.00$/, "");
const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
const estimateOf = (idea: Idea) =>
  isEstimated(idea) ? `${money(idea.teamLow!)} to ${money(idea.teamHigh!)} · ${days(idea.teamDays!)}` : "";

function Lines({ lines }: { lines: string[] }) {
  return (
    <div className="st-brief-notes">
      {lines.map((line, i) => <p key={i}>{line}</p>)}
    </div>
  );
}

/** The three numbers the team gives for one video. */
function EstimateFields({ idea }: { idea?: Idea }) {
  return (
    <div className="st-estimate-row">
      <label>
        Cost to make it, from (USD)
        <input name="low" type="number" inputMode="decimal" min="0" step="0.01" required defaultValue={idea?.teamLow ?? ""} placeholder="e.g. 800" />
      </label>
      <label>
        To (USD)
        <input name="high" type="number" inputMode="decimal" min="0" step="0.01" required defaultValue={idea?.teamHigh ?? ""} placeholder="e.g. 1200" />
      </label>
      <label>
        Working days to make it
        <input name="days" type="number" inputMode="decimal" min="0.5" step="0.5" required defaultValue={idea?.teamDays ?? ""} placeholder="e.g. 10" />
      </label>
    </div>
  );
}

function IdeaDrop({ project, idea, action }: { project: Project; idea: Idea; action: Action }) {
  const estimate = estimateOf(idea);
  return (
    <details className="st-drop">
      <summary>
        <span className="st-drop-title">{idea.name}</span>
        <span className="st-drop-meta">
          {idea.seconds !== null ? <span className="st-chip">{idea.seconds} sec</span> : null}
          {estimate ? (
            <span className="st-chip st-chip-active">{estimate}</span>
          ) : (
            <span className="st-chip st-chip-mid">Needs your estimate</span>
          )}
        </span>
      </summary>
      <div className="st-drop-body">
        {idea.idea ? <p className="st-drop-text">{idea.idea}</p> : <p className="st-muted">No summary has been written for this idea yet.</p>}
        {idea.details.length ? (
          <details className="st-drop st-drop-quiet">
            <summary><span className="st-drop-title">Full script</span></summary>
            <div className="st-drop-body"><Lines lines={idea.details} /></div>
          </details>
        ) : null}
        <form action={action} className="st-estimate-form">
          <input type="hidden" name="project" value={project.id} />
          <input type="hidden" name="idea" value={idea.id} />
          <EstimateFields idea={idea} />
          <div>
            <SubmitButton className="st-btn st-btn-primary" pendingLabel="Saving…">
              {estimate ? "Update estimate" : "Submit estimate"}
            </SubmitButton>
          </div>
        </form>
      </div>
    </details>
  );
}

function ClientDrop({
  project,
  isAdmin,
  open,
  estimateAction,
  addAction,
}: {
  project: Project;
  isAdmin: boolean;
  open: boolean;
  estimateAction: Action;
  addAction: Action;
}) {
  const wants: [string, string][] = [
    ["What they need", project.needs],
    ["Why they need it", project.why],
    ["What it's for", project.usedFor],
    ["Their budget", project.budget],
    ["Quoted so far", project.quoted === null ? "" : usd(project.quoted)],
  ];
  const filled = wants.filter(([, value]) => value);
  const estimated = project.ideas.filter(isEstimated).length;
  return (
    <details className="st-card st-drop st-drop-client" open={open}>
      <summary>
        <span className="st-drop-title">{project.name}</span>
        <span className="st-drop-meta">
          {isAdmin ? (
            project.assignedTo.length ? (
              <span className="st-muted st-small">For {project.assignedTo.join(", ")}</span>
            ) : (
              <span className="st-chip st-chip-high">Not assigned to anyone</span>
            )
          ) : null}
          <span className={`st-chip ${project.ideas.length && estimated === project.ideas.length ? "st-chip-active" : ""}`}>
            {project.ideas.length
              ? `${estimated} of ${project.ideas.length} estimated`
              : "No ideas yet"}
          </span>
        </span>
      </summary>
      <div className="st-drop-body">
        <details className="st-drop">
          <summary><span className="st-drop-title">Who the client is</span></summary>
          <div className="st-drop-body">
            {project.who ? <p className="st-drop-text">{project.who}</p> : <p className="st-muted">Not written yet.</p>}
          </div>
        </details>

        <details className="st-drop">
          <summary><span className="st-drop-title">What the client wants</span></summary>
          <div className="st-drop-body">
            {filled.length ? (
              <dl className="st-brief">
                {filled.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="st-muted">Not written yet.</p>
            )}
            {project.notes.length ? (
              <>
                <h3 className="st-subhead">Notes from Daniel</h3>
                <Lines lines={project.notes} />
              </>
            ) : null}
          </div>
        </details>

        <details className="st-drop" open={open}>
          <summary>
            <span className="st-drop-title">Ideas to pitch</span>
            <span className="st-drop-meta"><span className="st-chip">{project.ideas.length}</span></span>
          </summary>
          <div className="st-drop-body">
            {project.ideas.length ? (
              <p className="st-muted st-small">
                Open each idea, give a cost range and the working days, and submit. When every idea has an estimate it goes back to Daniel by itself.
              </p>
            ) : (
              <p className="st-muted">No ideas on this project yet. Add yours below.</p>
            )}
            {project.ideas.map((idea) => (
              <IdeaDrop key={idea.id} project={project} idea={idea} action={estimateAction} />
            ))}

            {/* Keyed by the idea count so the fields clear once an idea is added. */}
            <details key={project.ideas.length} className="st-drop st-drop-quiet">
              <summary><span className="st-drop-title">Add an idea of your own</span></summary>
              <div className="st-drop-body">
                <form action={addAction} className="st-estimate-form">
                  <input type="hidden" name="project" value={project.id} />
                  <label>
                    Short name
                    <input name="title" type="text" required maxLength={120} placeholder="Mascot opens the shop" />
                  </label>
                  <label>
                    What happens in the video
                    <textarea name="what" rows={4} required maxLength={6000} placeholder="What we see, the style, and how we would make it." />
                  </label>
                  <label className="st-estimate-seconds">
                    Length in seconds
                    <input name="seconds" type="number" inputMode="numeric" min="1" step="1" placeholder="e.g. 30" />
                  </label>
                  <EstimateFields />
                  <div>
                    <SubmitButton className="st-btn" pendingLabel="Adding…">Add idea</SubmitButton>
                  </div>
                </form>
              </div>
            </details>
          </div>
        </details>

        {isAdmin ? (
          <p className="st-small"><a href={project.url} target="_blank" rel="noreferrer">Open in Notion</a></p>
        ) : null}
      </div>
    </details>
  );
}

export function ClientsView({
  isAdmin,
  board,
  problem,
  error,
  sent,
  saved,
  open,
  estimateAction,
  addAction,
}: {
  isAdmin: boolean;
  board: { waiting: Project[]; sent: Project[] } | null;
  problem: string;
  error?: string;
  sent?: string;
  saved?: string;
  open?: string;
  estimateAction: Action;
  addAction: Action;
}) {
  return (
    <>
      <div className="st-head">
        <div>
          <h1>Potential clients</h1>
          <p className="st-muted">
            {isAdmin
              ? "Every project set to Team check / Estimate in Notion, whoever it's assigned to."
              : "Client requests Daniel sent you. Open one to see who the client is, what they want and the ideas, then estimate each idea."}
          </p>
        </div>
      </div>

      {error ? <p className="st-error" role="alert">{error}</p> : null}
      {saved ? <p className="st-note" role="status">Estimate saved for {saved}.</p> : null}
      {sent ? (
        <p className="st-note" role="status">Every idea for {sent} has an estimate. It&apos;s back with Daniel.</p>
      ) : null}
      {problem ? (
        <p className="st-error" role="alert">
          Couldn&apos;t read the proposal board from Notion.{isAdmin ? ` ${problem}` : " Tell Daniel."}
        </p>
      ) : null}

      {board && !board.waiting.length ? (
        <section className="st-card st-panel">
          <p className="st-empty">No client requests are waiting for an estimate.</p>
        </section>
      ) : null}

      {board?.waiting.map((project) => (
        <ClientDrop
          key={project.id}
          project={project}
          isAdmin={isAdmin}
          open={open === project.id}
          estimateAction={estimateAction}
          addAction={addAction}
        />
      ))}

      {board?.sent.length ? (
        <section className="st-card st-panel">
          <h2>Estimated</h2>
          <div className="st-table-wrap">
            <table className="st-table">
              <thead><tr><th>Client request</th><th>Sent</th><th>By</th><th>Estimates</th></tr></thead>
              <tbody>
                {board.sent.map((p) => (
                  <tr key={p.id}>
                    <td>{isAdmin ? <a href={p.url} target="_blank" rel="noreferrer">{p.name}</a> : p.name}</td>
                    <td className="st-nowrap">{day(p.checkedAt)}</td>
                    <td>{p.checkedBy || "–"}</td>
                    <td>
                      {p.ideas.filter(isEstimated).length
                        ? p.ideas.filter(isEstimated).map((idea) => (
                            <div key={idea.id}>{idea.name}: {estimateOf(idea)}</div>
                          ))
                        : p.teamNotes || "–"}
                    </td>
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
