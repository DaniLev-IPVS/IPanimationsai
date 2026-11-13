import { usd } from "@/lib/studio/filters";
import { DICT, LANGS, LOCALE, daysLabel, fill, type Dict, type Lang } from "@/lib/studio/i18n";
import { isEstimated, type Idea, type Project } from "@/lib/studio/proposals";
import { LangSwitch, SubmitButton } from "../../ui";

type Action = (fd: FormData) => Promise<void>;
/** The interface text and the language it is in, passed down to every part. */
type Words = { L: Dict; lang: Lang };

const money = (n: number) => usd(n).replace(/\.00$/, "");
const estimateOf = (idea: Idea, { L, lang }: Words) =>
  isEstimated(idea)
    ? `${fill(L.rangeTo, { low: money(idea.teamLow!), high: money(idea.teamHigh!) })} · ${daysLabel(lang, idea.teamDays!)}`
    : "";

function Lines({ lines }: { lines: string[] }) {
  return (
    <div className="st-brief-notes">
      {lines.map((line, i) => <p key={i}>{line}</p>)}
    </div>
  );
}

/** The three numbers the team gives for one video. */
function EstimateFields({ idea, L }: { idea?: Idea; L: Dict }) {
  return (
    <div className="st-estimate-row">
      <label>
        {L.costFrom}
        <input name="low" type="number" inputMode="decimal" min="0" step="0.01" required defaultValue={idea?.teamLow ?? ""} placeholder={fill(L.eg, { n: 800 })} />
      </label>
      <label>
        {L.costTo}
        <input name="high" type="number" inputMode="decimal" min="0" step="0.01" required defaultValue={idea?.teamHigh ?? ""} placeholder={fill(L.eg, { n: 1200 })} />
      </label>
      <label>
        {L.days}
        <input name="days" type="number" inputMode="decimal" min="0.5" step="0.5" required defaultValue={idea?.teamDays ?? ""} placeholder={fill(L.eg, { n: 10 })} />
      </label>
    </div>
  );
}

function IdeaDrop({ project, idea, action, words }: { project: Project; idea: Idea; action: Action; words: Words }) {
  const { L } = words;
  const estimate = estimateOf(idea, words);
  return (
    <details className="st-drop">
      <summary>
        <span className="st-drop-title">{idea.name}</span>
        <span className="st-drop-meta">
          {idea.seconds !== null ? <span className="st-chip">{fill(L.seconds, { n: idea.seconds })}</span> : null}
          {estimate ? (
            <span className="st-chip st-chip-active">{estimate}</span>
          ) : (
            <span className="st-chip st-chip-mid">{L.needsEstimate}</span>
          )}
        </span>
      </summary>
      <div className="st-drop-body">
        {idea.idea ? <p className="st-drop-text">{idea.idea}</p> : <p className="st-muted">{L.noSummary}</p>}
        {idea.details.length ? (
          <details className="st-drop st-drop-quiet">
            <summary><span className="st-drop-title">{L.fullScript}</span></summary>
            <div className="st-drop-body"><Lines lines={idea.details} /></div>
          </details>
        ) : null}
        <form action={action} className="st-estimate-form">
          <input type="hidden" name="project" value={project.id} />
          <input type="hidden" name="idea" value={idea.id} />
          <EstimateFields idea={idea} L={L} />
          <div>
            <SubmitButton className="st-btn st-btn-primary" pendingLabel={L.saving}>
              {estimate ? L.update : L.submit}
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
  words,
}: {
  project: Project;
  isAdmin: boolean;
  open: boolean;
  estimateAction: Action;
  addAction: Action;
  words: Words;
}) {
  const { L } = words;
  const wants: [string, string][] = [
    [L.needs, project.needs],
    [L.why, project.why],
    [L.usedFor, project.usedFor],
    [L.budget, project.budget],
    [L.quoted, project.quoted === null ? "" : usd(project.quoted)],
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
              <span className="st-muted st-small">{fill(L.forPeople, { names: project.assignedTo.join(", ") })}</span>
            ) : (
              <span className="st-chip st-chip-high">{L.notAssigned}</span>
            )
          ) : null}
          <span className={`st-chip ${project.ideas.length && estimated === project.ideas.length ? "st-chip-active" : ""}`}>
            {project.ideas.length
              ? fill(L.estimatedOf, { done: estimated, total: project.ideas.length })
              : L.noIdeasYet}
          </span>
        </span>
      </summary>
      <div className="st-drop-body">
        <details className="st-drop">
          <summary><span className="st-drop-title">{L.who}</span></summary>
          <div className="st-drop-body">
            {project.who ? <p className="st-drop-text">{project.who}</p> : <p className="st-muted">{L.notWritten}</p>}
          </div>
        </details>

        <details className="st-drop">
          <summary><span className="st-drop-title">{L.wants}</span></summary>
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
              <p className="st-muted">{L.notWritten}</p>
            )}
            {project.notes.length ? (
              <>
                <h3 className="st-subhead">{L.notes}</h3>
                <Lines lines={project.notes} />
              </>
            ) : null}
          </div>
        </details>

        <details className="st-drop" open={open}>
          <summary>
            <span className="st-drop-title">{L.ideas}</span>
            <span className="st-drop-meta"><span className="st-chip">{project.ideas.length}</span></span>
          </summary>
          <div className="st-drop-body">
            {project.ideas.length ? (
              <p className="st-muted st-small">{L.ideasHint}</p>
            ) : (
              <p className="st-muted">{L.noIdeas}</p>
            )}
            {project.ideas.map((idea) => (
              <IdeaDrop key={idea.id} project={project} idea={idea} action={estimateAction} words={words} />
            ))}

            {/* Keyed by the idea count so the fields clear once an idea is added. */}
            <details key={project.ideas.length} className="st-drop st-drop-quiet">
              <summary><span className="st-drop-title">{L.addOwn}</span></summary>
              <div className="st-drop-body">
                <form action={addAction} className="st-estimate-form">
                  <input type="hidden" name="project" value={project.id} />
                  <label>
                    {L.shortName}
                    <input name="title" type="text" required maxLength={120} placeholder={L.shortNameHint} />
                  </label>
                  <label>
                    {L.whatHappens}
                    <textarea name="what" rows={4} required maxLength={6000} placeholder={L.whatHappensHint} />
                  </label>
                  <label className="st-estimate-seconds">
                    {L.lengthSeconds}
                    <input name="seconds" type="number" inputMode="numeric" min="1" step="1" placeholder={fill(L.eg, { n: 30 })} />
                  </label>
                  <EstimateFields L={L} />
                  <div>
                    <SubmitButton className="st-btn" pendingLabel={L.adding}>{L.addIdea}</SubmitButton>
                  </div>
                </form>
              </div>
            </details>
          </div>
        </details>

        {isAdmin ? (
          <p className="st-small"><a href={project.url} target="_blank" rel="noreferrer">{L.openInNotion}</a></p>
        ) : null}
      </div>
    </details>
  );
}

export function ClientsView({
  isAdmin,
  lang,
  translated,
  board,
  problem,
  error,
  sent,
  saved,
  open,
  estimateAction,
  addAction,
  langAction,
}: {
  isAdmin: boolean;
  lang: Lang;
  translated: boolean;
  board: { waiting: Project[]; sent: Project[] } | null;
  problem: string;
  error?: string;
  sent?: string;
  saved?: string;
  open?: string;
  estimateAction: Action;
  addAction: Action;
  langAction: (lang: string) => Promise<void>;
}) {
  const L = DICT[lang];
  const words: Words = { L, lang };
  const day = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(LOCALE[lang], { month: "short", day: "numeric" }) : "–";
  return (
    <div lang={lang} className="st-clients">
      <div className="st-head">
        <div>
          <h1>{L.title}</h1>
          <p className="st-muted">{isAdmin ? L.introAdmin : L.introTeam}</p>
        </div>
        <LangSwitch
          current={lang}
          langs={Object.entries(LANGS)}
          label={L.translate}
          busyLabel={L.translating}
          action={langAction}
        />
      </div>

      {error ? <p className="st-error" role="alert">{error}</p> : null}
      {!translated ? <p className="st-note" role="status">{L.translationFailed}</p> : null}
      {saved ? <p className="st-note" role="status">{fill(L.saved, { name: saved })}</p> : null}
      {sent ? <p className="st-note" role="status">{fill(L.sent, { name: sent })}</p> : null}
      {problem ? (
        <p className="st-error" role="alert">
          {L.problem} {isAdmin ? problem : L.tellDaniel}
        </p>
      ) : null}

      {board && !board.waiting.length ? (
        <section className="st-card st-panel">
          <p className="st-empty">{L.empty}</p>
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
          words={words}
        />
      ))}

      {board?.sent.length ? (
        <section className="st-card st-panel">
          <h2>{L.estimated}</h2>
          <div className="st-table-wrap">
            <table className="st-table">
              <thead><tr><th>{L.colRequest}</th><th>{L.colSent}</th><th>{L.colBy}</th><th>{L.colEstimates}</th></tr></thead>
              <tbody>
                {board.sent.map((p) => (
                  <tr key={p.id}>
                    <td>{isAdmin ? <a href={p.url} target="_blank" rel="noreferrer">{p.name}</a> : p.name}</td>
                    <td className="st-nowrap">{day(p.checkedAt)}</td>
                    <td>{p.checkedBy || "–"}</td>
                    <td>
                      {p.ideas.filter(isEstimated).length
                        ? p.ideas.filter(isEstimated).map((idea) => (
                            <div key={idea.id}>{idea.name}: {estimateOf(idea, words)}</div>
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
    </div>
  );
}
