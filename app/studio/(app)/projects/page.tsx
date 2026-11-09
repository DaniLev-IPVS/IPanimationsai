import Link from "next/link";
import { requireUser } from "@/lib/studio/auth";
import { q } from "@/lib/studio/db";
import { num, usd } from "@/lib/studio/filters";
import { createProject } from "../../actions";
import { SubmitButton } from "../../ui";

const STATUS: Record<string, string> = { active: "Active", done: "Done", archived: "Archived" };

export default async function Projects({ searchParams }: { searchParams: { e?: string; all?: string } }) {
  const user = await requireUser();
  const owner = user.role === "admin" ? null : user.id;
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

  return (
    <>
      <div className="st-head">
        <div>
          <h1>Projects</h1>
          <p className="st-muted">{user.role === "admin" ? "Everyone's spend, by project." : "Your spend on each project."}</p>
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
                  <th className="num">Budget</th>
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
                    <td className="num">{p.budget_usd ? usd(p.budget_usd) : "–"}</td>
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
          <label>Budget (USD) <input name="budget" type="number" min="0" step="0.01" /></label>
          <SubmitButton className="st-btn st-btn-primary" pendingLabel="Adding…">Add project</SubmitButton>
        </form>
        <p className="st-muted st-small">
          In ComfyUI, save videos under the project&apos;s exact name, like <code>Project Name/Video Name/shot</code>, and their spend lands here on its own.
        </p>
      </section>
    </>
  );
}
