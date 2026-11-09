import Link from "next/link";
import { requireUser } from "@/lib/studio/auth";
import { getTimezone, q } from "@/lib/studio/db";
import { addDays, num, parseFilters, toQuery, usd, whereOf, type Filters, type Group, type Range } from "@/lib/studio/filters";
import { assignRender, bulkAssign, setRenderPerson, syncNow } from "../actions";
import { AutoSelect, SubmitButton } from "../ui";

const PAGE = 50;

type Option = { id: string; name: string; status: string; videos: { id: string; name: string }[] };

const RANGES: [Range, string][] = [
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["month", "This month"],
  ["lastmonth", "Last month"],
  ["all", "All time"],
];

const GROUP_SQL: Record<Group, { key: string; label: string; join: string }> = {
  day: { key: "to_char(r.created_at at time zone $2::text, 'YYYY-MM-DD')", label: "to_char(r.created_at at time zone $2::text, 'YYYY-MM-DD')", join: "" },
  project: { key: "p.id::text", label: "coalesce(p.name, 'Unassigned')", join: "left join studio.projects p on p.id = r.project_id" },
  video: {
    key: "v.id::text",
    label: "coalesce(p.name || ' / ' || v.name, p.name || ' / no video set', 'Unassigned')",
    join: "left join studio.videos v on v.id = r.video_id left join studio.projects p on p.id = r.project_id",
  },
  model: { key: "r.model", label: "r.model", join: "" },
  person: { key: "u.id::text", label: "u.name", join: "join studio.users u on u.id = r.user_id" },
};

const dayLabel = (d: string, withYear = false) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: withYear ? "numeric" : undefined, timeZone: "UTC" });

const shortModel = (m: string) => m.replace(/^dreamina-/, "").replace(/-\d{6}$/, "");

/** Whole-number axis top: 1, 2 or 5 times a power of ten. */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function Chart({ points, filters }: { points: { key: string; label: string; spend: number; n: number; day?: string }[]; filters: Filters }) {
  const max = niceMax(Math.max(0, ...points.map((p) => p.spend)));
  const every = Math.max(1, Math.ceil(points.length / 8));
  return (
    <div className="st-chart">
      <div className="st-chart-grid" aria-hidden="true">
        {[1, 0.5, 0].map((t) => (
          <div key={t} className="st-chart-line">
            <span>{usd(max * t).replace(/\.00$/, "")}</span>
          </div>
        ))}
      </div>
      <div className="st-chart-bars">
        {points.map((p, i) => {
          const tip = `${p.label}: ${usd(p.spend)}, ${num(p.n)} render${p.n === 1 ? "" : "s"}`;
          const bar = (
            <>
              <i className="st-bar" style={{ height: `${(p.spend / max) * 100}%` }} />
              <em className="st-tip">{tip}</em>
            </>
          );
          return (
            <div key={p.key} className="st-col">
              {p.day ? (
                <Link href={toQuery(filters, { range: undefined, from: p.day, to: p.day, page: undefined }) || "?"} aria-label={tip}>
                  {bar}
                </Link>
              ) : (
                <span tabIndex={0} aria-label={tip}>{bar}</span>
              )}
              <small>{i % every === 0 ? p.label : ""}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProjectOptions({ options }: { options: Option[] }) {
  return (
    <>
      {options.map((p) => (
        <optgroup key={p.id} label={p.name}>
          <option value={`${p.id}|`}>{p.name} (no video yet)</option>
          {p.videos.map((v) => (
            <option key={v.id} value={`${p.id}|${v.id}`}>{p.name} / {v.name}</option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

export default async function Spend({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const user = await requireUser();
  const tz = await getTimezone();
  const f = parseFilters(searchParams, tz, user);
  const isAdmin = user.role === "admin";
  const { where, params } = whereOf(f, user);
  const g = GROUP_SQL[f.group];

  const firstRender = f.range === "all"
    ? (await q<{ d: string | null }>(`select to_char(min(r.created_at) at time zone $2::text, 'YYYY-MM-DD') as d from studio.renders r where ${where}`, params))[0]?.d
    : null;
  const chartFrom = firstRender || f.from;
  const chartDays = Math.round((Date.parse(f.to) - Date.parse(chartFrom)) / 86400000) + 1;
  const monthly = chartDays > 62;

  const [totals, series, breakdown, renders, projectRows, videoRows, people, keys] = await Promise.all([
    q<{ spend: string; done: number; failed: number; unassigned: number; unassigned_spend: string; unpriced: number; tokens: string }>(
      `select coalesce(sum(r.cost_usd) filter (where r.status = 'succeeded'), 0) as spend,
              count(*) filter (where r.status = 'succeeded')::int as done,
              count(*) filter (where r.status = 'failed')::int as failed,
              count(*) filter (where r.status = 'succeeded' and r.project_id is null)::int as unassigned,
              coalesce(sum(r.cost_usd) filter (where r.status = 'succeeded' and r.project_id is null), 0) as unassigned_spend,
              count(*) filter (where r.status = 'succeeded' and r.cost_usd is null)::int as unpriced,
              coalesce(sum(r.total_tokens) filter (where r.status = 'succeeded'), 0) as tokens
         from studio.renders r where ${where}`,
      params,
    ),
    q<{ bucket: string; spend: string; n: number }>(
      `select to_char(r.created_at at time zone $2::text, '${monthly ? "YYYY-MM" : "YYYY-MM-DD"}') as bucket,
              coalesce(sum(r.cost_usd), 0) as spend, count(*)::int as n
         from studio.renders r where ${where} and r.status = 'succeeded' group by 1 order by 1`,
      params,
    ),
    q<{ key: string | null; label: string; spend: string; n: number; tokens: string; project_id: string | null }>(
      `select ${g.key} as key, ${g.label} as label, coalesce(sum(r.cost_usd), 0) as spend, count(*)::int as n,
              coalesce(sum(r.total_tokens), 0) as tokens, ${f.group === "project" ? "p.id::text" : "null"} as project_id
         from studio.renders r ${g.join}
        where ${where} and r.status = 'succeeded'
        group by 1, 2 order by ${f.group === "day" ? "1 desc" : "3 desc"}`,
      params,
    ),
    q<{
      id: string; model: string; status: string; resolution: string | null; ratio: string | null; duration_s: string | null;
      total_tokens: string | null; cost_usd: string | null; when_label: string; project_id: string | null; video_id: string | null;
      comfy_hint: string | null; assigned_via: string | null; user_id: string; person: string;
    }>(
      `select r.id, r.model, r.status, r.resolution, r.ratio, r.duration_s, r.total_tokens, r.cost_usd, r.project_id, r.video_id,
              r.comfy_hint, r.assigned_via, r.user_id, u.name as person,
              to_char(r.created_at at time zone $2::text, 'Mon FMDD, HH24:MI') as when_label
         from studio.renders r join studio.users u on u.id = r.user_id
        where ${where} order by r.created_at desc limit ${PAGE + 1} offset ${(f.page - 1) * PAGE}`,
      params,
    ),
    q<{ id: string; name: string; status: string }>(`select id, name, status from studio.projects order by name`),
    q<{ id: string; name: string; project_id: string }>(`select id, name, project_id from studio.videos order by name`),
    isAdmin ? q<{ id: string; name: string }>(`select id, name from studio.users where active order by name`) : Promise.resolve([]),
    q<{ last_sync_at: string | null; n: number }>(`select max(last_sync_at) as last_sync_at, count(*)::int as n from studio.api_keys where active`),
  ]);

  const t = totals[0];
  const spend = Number(t.spend);
  const options: Option[] = projectRows.map((p) => ({
    ...p,
    videos: videoRows.filter((v) => v.project_id === p.id),
  }));
  const activeOptions = options.filter((p) => p.status === "active");

  // Every day (or month) on the axis, including empty ones.
  const bySeries: Record<string, { spend: number; n: number }> = {};
  series.forEach((s) => (bySeries[s.bucket] = { spend: Number(s.spend), n: s.n }));
  const points: { key: string; label: string; spend: number; n: number; day?: string }[] = [];
  if (monthly) {
    let cursor = `${chartFrom.slice(0, 7)}-01`;
    while (cursor <= f.to) {
      const k = cursor.slice(0, 7);
      points.push({
        key: k,
        label: new Date(`${cursor}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
        spend: bySeries[k]?.spend || 0,
        n: bySeries[k]?.n || 0,
      });
      cursor = addDays(cursor, 32).slice(0, 7) + "-01";
    }
  } else {
    for (let i = 0; i < chartDays; i++) {
      const d = addDays(chartFrom, i);
      points.push({ key: d, label: dayLabel(d), spend: bySeries[d]?.spend || 0, n: bySeries[d]?.n || 0, day: d });
    }
  }

  const hasMore = renders.length > PAGE;
  const rows = renders.slice(0, PAGE);
  const lastSync = keys[0]?.last_sync_at
    ? new Date(keys[0].last_sync_at).toLocaleString("en-US", { timeZone: tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;
  const noKeys = !keys[0]?.n;
  const rangeTitle = f.range === "all" ? "All time" : f.from === f.to ? dayLabel(f.from, true) : `${dayLabel(f.from)} to ${dayLabel(f.to, true)}`;
  const groups: [Group, string][] = [
    ["day", "Day"],
    ["project", "Project"],
    ["video", "Video"],
    ["model", "Model"],
    ...(isAdmin ? ([["person", "Person"]] as [Group, string][]) : []),
  ];

  return (
    <>
      <div className="st-head">
        <div>
          <h1>{isAdmin ? "Spend" : "Your spend"}</h1>
          <p className="st-muted">{rangeTitle}</p>
        </div>
        <form action={syncNow} className="st-sync">
          <span className="st-muted st-small">{lastSync ? `Updated ${lastSync}` : noKeys ? "No BytePlus key yet" : "Not synced yet"}</span>
          <SubmitButton pendingLabel="Updating…">Update now</SubmitButton>
        </form>
      </div>

      <div className="st-filters">
        <div className="st-seg" role="group" aria-label="Date range">
          {RANGES.map(([r, label]) => (
            <Link key={r} href={toQuery(f, { range: r, from: undefined, to: undefined, page: undefined })} aria-current={f.range === r ? "true" : undefined}>
              {label}
            </Link>
          ))}
        </div>
        <form className="st-filter-form" method="get">
          <label>From <input type="date" name="from" defaultValue={f.from} /></label>
          <label>To <input type="date" name="to" defaultValue={f.to} /></label>
          <label>
            Project
            <select name="project" defaultValue={f.project}>
              <option value="">All projects</option>
              <option value="none">Unassigned</option>
              {options.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          {isAdmin ? (
            <label>
              Person
              <select name="person" defaultValue={f.person}>
                <option value="">Everyone</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          ) : null}
          {f.group !== "day" ? <input type="hidden" name="group" value={f.group} /> : null}
          <button className="st-btn" type="submit">Apply</button>
        </form>
      </div>

      <section className="st-stats" aria-label="Totals">
        <div className="st-card st-stat st-stat-hero"><span>Spent</span><b>{usd(spend)}</b></div>
        <div className="st-card st-stat"><span>Finished renders</span><b>{num(t.done)}</b></div>
        <div className="st-card st-stat"><span>Average per render</span><b>{usd(t.done ? spend / t.done : 0)}</b></div>
        <Link className="st-card st-stat st-stat-link" href={toQuery(f, { show: f.unassigned ? undefined : "unassigned", page: undefined }) || "?"}>
          <span>Unassigned</span>
          <b>{num(t.unassigned)}</b>
          <small className="st-muted">{usd(t.unassigned_spend)}, {f.unassigned ? "show all" : "show them"}</small>
        </Link>
      </section>

      {t.unpriced > 0 ? (
        <p className="st-note" role="status">
          {num(t.unpriced)} render{t.unpriced === 1 ? " has" : "s have"} no price yet, so {t.unpriced === 1 ? "it isn't" : "they aren't"} in the total.
          {isAdmin ? <> Add the model in <Link href="/studio/settings">Settings</Link>.</> : " Ask an admin to add the model's price."}
        </p>
      ) : null}

      <section className="st-card st-panel">
        <h2>Spend over time</h2>
        {spend > 0 ? <Chart points={points} filters={f} /> : <p className="st-empty">No spend in this period.</p>}
      </section>

      <section className="st-card st-panel">
        <div className="st-panel-head">
          <h2>Breakdown</h2>
          <div className="st-seg" role="group" aria-label="Group by">
            {groups.map(([gr, label]) => (
              <Link key={gr} href={toQuery(f, { group: gr === "day" ? undefined : gr, page: undefined }) || "?"} aria-current={f.group === gr ? "true" : undefined}>
                {label}
              </Link>
            ))}
          </div>
        </div>
        {breakdown.length ? (
          <div className="st-table-wrap">
            <table className="st-table">
              <thead>
                <tr>
                  <th>{groups.filter(([gr]) => gr === f.group)[0][1]}</th>
                  <th className="num">Renders</th>
                  <th className="num">Tokens</th>
                  <th className="num">Spent</th>
                  <th className="num">Share</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((b) => (
                  <tr key={String(b.key)}>
                    <td>
                      {f.group === "project" && b.project_id ? (
                        <Link href={`/studio/projects/${b.project_id}`}>{b.label}</Link>
                      ) : f.group === "day" ? (
                        dayLabel(b.label, true)
                      ) : f.group === "model" ? (
                        shortModel(b.label)
                      ) : (
                        b.label
                      )}
                    </td>
                    <td className="num">{num(b.n)}</td>
                    <td className="num">{num(b.tokens)}</td>
                    <td className="num">{usd(b.spend)}</td>
                    <td className="num">{spend ? `${Math.round((Number(b.spend) / spend) * 100)}%` : "0%"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="st-empty">Nothing to break down yet.</p>
        )}
      </section>

      <section className="st-card st-panel">
        <h2>Renders</h2>
        {t.unassigned > 0 && activeOptions.length ? (
          <form action={bulkAssign} className="st-bulk">
            <input type="hidden" name="qs" value={toQuery(f, { page: undefined, show: undefined }).replace(/^\?/, "")} />
            <span>Put all {num(t.unassigned)} unassigned renders from this view on</span>
            <select name="target" required aria-label="Project or video" defaultValue="">
              <option value="" disabled>Choose a project</option>
              <ProjectOptions options={activeOptions} />
            </select>
            <SubmitButton pendingLabel="Saving…">Assign all</SubmitButton>
          </form>
        ) : null}
        {t.unassigned > 0 && !activeOptions.length ? (
          <p className="st-note"><Link href="/studio/projects">Add a project</Link> to start assigning renders.</p>
        ) : null}
        {rows.length ? (
          <div className="st-table-wrap">
            <table className="st-table st-renders">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Render</th>
                  {isAdmin ? <th>Person</th> : null}
                  <th>Project and video</th>
                  <th className="num">Cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.status === "succeeded" ? "" : "is-off"}>
                    <td className="st-nowrap">{r.when_label}</td>
                    <td>
                      {shortModel(r.model)}
                      <small className="st-muted">
                        {[r.resolution, r.ratio, r.duration_s ? `${Number(r.duration_s)}s` : null].filter(Boolean).join(" · ")}
                        {r.status !== "succeeded" ? ` · ${r.status}` : ""}
                      </small>
                    </td>
                    {isAdmin ? (
                      <td>
                        <form action={setRenderPerson}>
                          <input type="hidden" name="id" value={r.id} />
                          <AutoSelect name="person" defaultValue={r.user_id} label="Person">
                            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            {people.some((p) => p.id === r.user_id) ? null : <option value={r.user_id}>{r.person}</option>}
                          </AutoSelect>
                        </form>
                      </td>
                    ) : null}
                    <td>
                      <form action={assignRender} key={`${r.project_id}|${r.video_id}`}>
                        <input type="hidden" name="id" value={r.id} />
                        <AutoSelect name="target" defaultValue={r.project_id ? `${r.project_id}|${r.video_id || ""}` : ""} label="Project and video">
                          <option value="">Unassigned</option>
                          <ProjectOptions options={options.filter((p) => p.status === "active" || p.id === r.project_id)} />
                        </AutoSelect>
                      </form>
                      {r.comfy_hint ? <small className="st-muted">ComfyUI: {r.comfy_hint}</small> : null}
                    </td>
                    <td className="num">{r.status !== "succeeded" ? "–" : r.cost_usd == null ? "No price" : usd(r.cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="st-empty">
            {noKeys ? (isAdmin ? <>Add a BytePlus key in <Link href="/studio/settings">Settings</Link> and renders will show up here.</> : "Renders will show up here once a BytePlus key is connected.") : "No renders in this period."}
          </p>
        )}
        {f.page > 1 || hasMore ? (
          <div className="st-pager">
            {f.page > 1 ? <Link className="st-btn" href={toQuery(f, { page: f.page - 1 })}>Newer</Link> : <span />}
            {hasMore ? <Link className="st-btn" href={toQuery(f, { page: f.page + 1 })}>Older</Link> : null}
          </div>
        ) : null}
      </section>

      <p className="st-muted st-small st-foot">
        Spend is worked out from each render&apos;s BytePlus tokens and the price list in Settings. Times are {tz}.
      </p>
    </>
  );
}
