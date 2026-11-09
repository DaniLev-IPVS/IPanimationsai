import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/studio/auth";
import { isUuid, one, q } from "@/lib/studio/db";
import { num, usd } from "@/lib/studio/filters";
import { createVideo, setVideoStatus, updateProject } from "../../../actions";
import { AutoSelect, SubmitButton } from "../../../ui";

export default async function Project({ params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!isUuid(params.id)) notFound();
  const owner = user.role === "admin" ? null : user.id;

  const project = await one<{
    id: string; name: string; client: string | null; status: string; budget_usd: string | null; spend: string; renders: number; team_spend: string;
  }>(
    `select p.id, p.name, p.client, p.status, p.budget_usd,
            coalesce(sum(r.cost_usd) filter (where $2::uuid is null or r.user_id = $2::uuid), 0) as spend,
            (count(r.id) filter (where $2::uuid is null or r.user_id = $2::uuid))::int as renders,
            coalesce(sum(r.cost_usd), 0) as team_spend
       from studio.projects p
       left join studio.renders r on r.project_id = p.id and r.status = 'succeeded'
      where p.id = $1 group by p.id`,
    [params.id, owner],
  );
  if (!project) notFound();

  const videos = await q<{ id: string; name: string; status: string; renders: number; spend: string; last_render: string | null }>(
    `select v.id, v.name, v.status, count(r.id)::int as renders, coalesce(sum(r.cost_usd), 0) as spend,
            to_char(max(r.created_at), 'Mon FMDD') as last_render
       from studio.videos v
       left join studio.renders r on r.video_id = v.id and r.status = 'succeeded' and ($2::uuid is null or r.user_id = $2::uuid)
      where v.project_id = $1 group by v.id order by v.created_at`,
    [params.id, owner],
  );
  const loose = await one<{ n: number; spend: string }>(
    `select count(*)::int as n, coalesce(sum(cost_usd), 0) as spend from studio.renders
      where project_id = $1 and video_id is null and status = 'succeeded' and ($2::uuid is null or user_id = $2::uuid)`,
    [params.id, owner],
  );

  const budget = project.budget_usd ? Number(project.budget_usd) : 0;
  const used = budget ? Number(project.team_spend) / budget : 0;

  return (
    <>
      <div className="st-head">
        <div>
          <Link className="st-link st-small" href="/studio/projects">All projects</Link>
          <h1>{project.name}</h1>
          {project.client ? <p className="st-muted">{project.client}</p> : null}
        </div>
        <Link className="st-btn" href={`/studio?project=${project.id}&range=all`}>See its renders</Link>
      </div>

      <section className="st-stats" aria-label="Totals">
        <div className="st-card st-stat st-stat-hero"><span>{user.role === "admin" ? "Spent" : "You spent"}</span><b>{usd(project.spend)}</b></div>
        <div className="st-card st-stat"><span>Finished renders</span><b>{num(project.renders)}</b></div>
        <div className="st-card st-stat"><span>Videos</span><b>{num(videos.length)}</b></div>
        {budget && user.role === "admin" ? (
          <div className="st-card st-stat">
            <span>Budget used</span>
            <b>{Math.round(used * 100)}%</b>
            <div className="st-meter" role="img" aria-label={`${usd(project.team_spend)} of ${usd(budget)}`}>
              <i style={{ width: `${Math.min(100, used * 100)}%` }} className={used > 1 ? "is-over" : ""} />
            </div>
            <small className="st-muted">{usd(project.team_spend)} of {usd(budget)}</small>
          </div>
        ) : null}
      </section>

      <section className="st-card st-panel">
        <h2>Videos</h2>
        {videos.length ? (
          <div className="st-table-wrap">
            <table className="st-table">
              <thead>
                <tr>
                  <th>Video</th>
                  <th>Status</th>
                  <th className="num">Renders</th>
                  <th className="num">Last render</th>
                  <th className="num">Spent</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((v) => (
                  <tr key={v.id}>
                    <td>{v.name}</td>
                    <td>
                      <form action={setVideoStatus}>
                        <input type="hidden" name="id" value={v.id} />
                        <AutoSelect name="status" defaultValue={v.status} label={`Status of ${v.name}`}>
                          <option value="in_production">In production</option>
                          <option value="delivered">Delivered</option>
                        </AutoSelect>
                      </form>
                    </td>
                    <td className="num">{num(v.renders)}</td>
                    <td className="num">{v.last_render || "–"}</td>
                    <td className="num">{usd(v.spend)}</td>
                  </tr>
                ))}
                {loose && loose.n > 0 ? (
                  <tr className="is-off">
                    <td>Not on a video yet</td>
                    <td />
                    <td className="num">{num(loose.n)}</td>
                    <td />
                    <td className="num">{usd(loose.spend)}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="st-empty">No videos yet.</p>
        )}
        <form action={createVideo} className="st-form-row st-form-top">
          <input type="hidden" name="project" value={project.id} />
          <label>New video <input name="name" required /></label>
          <SubmitButton pendingLabel="Adding…">Add video</SubmitButton>
        </form>
      </section>

      {user.role === "admin" ? (
        <section className="st-card st-panel">
          <h2>Project details</h2>
          <form action={updateProject} className="st-form-row">
            <input type="hidden" name="id" value={project.id} />
            <label>Name <input name="name" defaultValue={project.name} required /></label>
            <label>Client <input name="client" defaultValue={project.client || ""} /></label>
            <label>Budget (USD) <input name="budget" type="number" min="0" step="0.01" defaultValue={project.budget_usd || ""} /></label>
            <label>
              Status
              <select name="status" defaultValue={project.status}>
                <option value="active">Active</option>
                <option value="done">Done</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
          </form>
        </section>
      ) : null}
    </>
  );
}
