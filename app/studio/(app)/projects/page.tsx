import Link from "next/link";
import { requireUser } from "@/lib/studio/auth";
import { q } from "@/lib/studio/db";
import { num, usd } from "@/lib/studio/filters";
import { addNameRule, createProject, deleteNameRule } from "../../actions";
import { SubmitButton } from "../../ui";

const STATUS: Record<string, string> = { active: "Active", done: "Done", archived: "Archived" };

type Option = { id: string; name: string; videos: { id: string; name: string }[] };

function Targets({ options }: { options: Option[] }) {
  return (
    <>
      {options.map((p) => (
        <optgroup key={p.id} label={p.name}>
          <option value={`${p.id}|`}>{p.name}</option>
          {p.videos.map((v) => (
            <option key={v.id} value={`${p.id}|${v.id}`}>{p.name} / {v.name}</option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

function NamingRules({
  rules,
  unmatched,
  options,
}: {
  rules: { id: string; match_text: string; project: string; video: string | null }[];
  unmatched: { filename_prefix: string; renders: number; spend: string }[];
  options: Option[];
}) {
  return (
    <section className="st-card st-panel">
      <h2>Naming rules</h2>
      <p className="st-muted st-small">
        Nikita can name files however he likes. If a file name contains the text below, its renders go to that project. Capitals, spaces and punctuation don&apos;t matter. A file name that already contains a project&apos;s name is filed automatically, with no rule needed.
      </p>
      {rules.length ? (
        <div className="st-table-wrap">
          <table className="st-table">
            <thead><tr><th>If the file name contains</th><th>File it under</th><th /></tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td><code>{r.match_text}</code></td>
                  <td>{r.project}{r.video ? ` / ${r.video}` : ""}</td>
                  <td className="num">
                    <form action={deleteNameRule}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="st-link" type="submit">Remove</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {options.length ? (
        <form action={addNameRule} className="st-form-row st-form-top">
          <label>If the file name contains <input name="text" required placeholder="wsh_ep3" /></label>
          <label>
            File it under
            <select name="target" required defaultValue="">
              <option value="" disabled>Choose a project</option>
              <Targets options={options} />
            </select>
          </label>
          <SubmitButton pendingLabel="Saving…">Add rule</SubmitButton>
        </form>
      ) : (
        <p className="st-empty">Add a project first.</p>
      )}
      {unmatched.length && options.length ? (
        <>
          <h3 className="st-subhead">File names waiting for a rule</h3>
          <div className="st-table-wrap">
            <table className="st-table">
              <thead><tr><th>Nikita&apos;s file name</th><th className="num">Renders</th><th className="num">Spent</th><th>Make a rule</th></tr></thead>
              <tbody>
                {unmatched.map((u) => (
                  <tr key={u.filename_prefix}>
                    <td><code>{u.filename_prefix}</code></td>
                    <td className="num">{num(u.renders)}</td>
                    <td className="num">{usd(u.spend)}</td>
                    <td>
                      <form action={addNameRule} className="st-inline-rule">
                        <input name="text" defaultValue={u.filename_prefix} required aria-label="Text to look for" />
                        <select name="target" required defaultValue="" aria-label="Project">
                          <option value="" disabled>Choose a project</option>
                          <Targets options={options} />
                        </select>
                        <SubmitButton pendingLabel="Saving…">Add</SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default async function Projects({ searchParams }: { searchParams: { e?: string; all?: string } }) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const owner = isAdmin ? null : user.id;
  const rows = await q<{
    id: string; name: string; client: string | null; status: string; budget_usd: string | null;
    videos: number; renders: number; spend: string; last_render: string | null;
  }>(
    `select p.id, p.name, p.client, p.status, p.budget_usd,
            (select count(*)::int from studio.videos v where v.project_id = p.id) as videos,
            count(r.id)::int as renders,
            coalesce(sum(r.cost_usd), 0) as spend,
            to_char(max(r.created_at), 'Mon FMDD') as last_render
       from studio.projects p
       left join studio.renders r on r.project_id = p.id and r.status = 'succeeded' and ($1::uuid is null or r.user_id = $1::uuid)
      where ($2::boolean or p.status <> 'archived')
      group by p.id
      order by case p.status when 'active' then 0 when 'done' then 1 else 2 end, p.name`,
    [owner, searchParams.all === "1"],
  );

  const [rules, unmatched, videos] = isAdmin
    ? await Promise.all([
        q<{ id: string; match_text: string; project: string; video: string | null }>(
          `select n.id, n.match_text, p.name as project, v.name as video
             from studio.name_rules n join studio.projects p on p.id = n.project_id
             left join studio.videos v on v.id = n.video_id order by lower(n.match_text)`,
        ),
        q<{ filename_prefix: string; renders: number; spend: string }>(
          `select c.filename_prefix, count(*)::int as renders, coalesce(sum(r.cost_usd), 0) as spend
             from studio.renders r join studio.comfy_runs c on c.prompt_id = r.comfy_prompt_id
            where r.project_id is null and r.status = 'succeeded' and c.filename_prefix is not null
            group by 1 order by 3 desc limit 30`,
        ),
        q<{ id: string; name: string; project_id: string }>(`select id, name, project_id from studio.videos order by name`),
      ])
    : [[], [], []];
  const options: Option[] = rows
    .filter((p) => p.status === "active")
    .map((p) => ({ id: p.id, name: p.name, videos: videos.filter((v) => v.project_id === p.id) }));

  return (
    <>
      <div className="st-head">
        <div>
          <h1>Projects</h1>
          <p className="st-muted">{isAdmin ? "Everyone's spend, by project." : "Your spend on each project."}</p>
        </div>
        <Link className="st-link" href={searchParams.all === "1" ? "/studio/projects" : "/studio/projects?all=1"}>
          {searchParams.all === "1" ? "Hide archived" : "Show archived"}
        </Link>
      </div>

      {searchParams.e ? <p className="st-error" role="alert">{searchParams.e}</p> : null}

      <section className="st-card st-panel">
        {rows.length ? (
          <div className="st-table-wrap">
            <table className="st-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th className="num">Videos</th>
                  <th className="num">Renders</th>
                  <th className="num">Last render</th>
                  <th className="num">Spent</th>
                  {isAdmin ? <th className="num">Budget</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/studio/projects/${p.id}`}>{p.name}</Link>
                      {p.client ? <small className="st-muted">{p.client}</small> : null}
                    </td>
                    <td><span className={`st-chip st-chip-${p.status}`}>{STATUS[p.status]}</span></td>
                    <td className="num">{num(p.videos)}</td>
                    <td className="num">{num(p.renders)}</td>
                    <td className="num">{p.last_render || "–"}</td>
                    <td className="num">{usd(p.spend)}</td>
                    {isAdmin ? <td className="num">{p.budget_usd ? usd(p.budget_usd) : "–"}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="st-empty">No projects yet. Add the first one below.</p>
        )}
      </section>

      <section className="st-card st-panel">
        <h2>New project</h2>
        <form action={createProject} className="st-form-row">
          <label>Name <input name="name" required /></label>
          <label>Client <input name="client" /></label>
          {isAdmin ? <label>Budget (USD) <input name="budget" type="number" min="0" step="0.01" /></label> : null}
          <SubmitButton className="st-btn st-btn-primary" pendingLabel="Adding…">Add project</SubmitButton>
        </form>
      </section>

      {isAdmin ? <NamingRules rules={rules} unmatched={unmatched} options={options} /> : null}
    </>
  );
}
