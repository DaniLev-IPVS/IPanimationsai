import { decryptSecret } from "./auth";
import { q } from "./db";

/**
 * BytePlus → Neon. Every Seedance render is a task on BytePlus, listed with its
 * model, resolution, tokens and time. BytePlus only keeps tasks for 7 days
 * (14 for drafts), so the hourly cron copies them here where they stay.
 *
 * That list covers the whole BytePlus account, whichever key asks, and says
 * nothing about which key made a render. So a render is filed under the account
 * owner until a person's own ComfyUI run proves it was theirs.
 */

const ARK = process.env.BYTEPLUS_BASE_URL || "https://ark.ap-southeast.bytepluses.com/api/v3";
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

type Task = {
  id: string;
  model: string;
  status: string;
  resolution?: string;
  ratio?: string;
  duration?: number;
  created_at: number;
  updated_at?: number;
  usage?: { total_tokens?: number; completion_tokens?: number };
};

export async function fetchTaskPage(apiKey: string, page: number, size = PAGE_SIZE): Promise<{ items: Task[]; total: number }> {
  const url = `${ARK}/contents/generations/tasks?page_num=${page}&page_size=${size}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    throw new Error(`BytePlus answered ${res.status}: ${detail}`);
  }
  const body = (await res.json()) as { items?: Task[]; total?: number };
  return { items: body.items || [], total: body.total || 0 };
}

type Rate = { model: string; resolution: string; usd_per_million: string };

function priceOf(task: Task, rates: Rate[]): number | null {
  if (task.status !== "succeeded") return 0;
  const tokens = task.usage?.total_tokens ?? task.usage?.completion_tokens;
  if (tokens == null) return null;
  const res = (task.resolution || "").toLowerCase();
  const rate =
    rates.find((r) => r.model === task.model && r.resolution === res) ||
    rates.find((r) => r.model === task.model && r.resolution === "*");
  return rate ? (tokens / 1_000_000) * Number(rate.usd_per_million) : null;
}

async function syncKey(key: { id: string; secret_enc: string }, owner: string, rates: Rate[]) {
  const apiKey = decryptSecret(key.secret_enc);
  let seen = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { items, total } = await fetchTaskPage(apiKey, page);
    if (!items.length) break;
    const rows = items.map((t) => ({
      id: t.id,
      model: t.model,
      status: t.status,
      resolution: t.resolution ? t.resolution.toLowerCase() : null,
      ratio: t.ratio ?? null,
      duration_s: t.duration != null && t.duration > 0 ? t.duration : null,
      total_tokens: t.usage?.total_tokens ?? t.usage?.completion_tokens ?? null,
      cost_usd: priceOf(t, rates),
      created_at: new Date(t.created_at * 1000).toISOString(),
      updated_at: t.updated_at ? new Date(t.updated_at * 1000).toISOString() : null,
    }));
    // A price is locked once set, so editing the list doesn't rewrite history.
    await q(
      `insert into studio.renders
         (id, api_key_id, user_id, model, status, resolution, ratio, duration_s, total_tokens, cost_usd, created_at, updated_at)
       select x.id, $2::uuid, $3::uuid, x.model, x.status, x.resolution, x.ratio, x.duration_s, x.total_tokens, x.cost_usd, x.created_at, x.updated_at
         from jsonb_to_recordset($1::jsonb) as x(
           id text, model text, status text, resolution text, ratio text, duration_s numeric,
           total_tokens bigint, cost_usd numeric, created_at timestamptz, updated_at timestamptz)
       on conflict (id) do update set
         status = excluded.status,
         resolution = excluded.resolution,
         ratio = excluded.ratio,
         duration_s = excluded.duration_s,
         total_tokens = excluded.total_tokens,
         updated_at = excluded.updated_at,
         cost_usd = case when studio.renders.status = 'succeeded' and studio.renders.cost_usd is not null
                         then studio.renders.cost_usd else excluded.cost_usd end`,
      [JSON.stringify(rows), key.id, owner],
    );
    seen += items.length;
    if (seen >= total || items.length < PAGE_SIZE) break;
  }
  return seen;
}

/** Fill in renders that had no price, after a rate is added. */
export async function repriceUnpriced() {
  await q(
    `update studio.renders r
        set cost_usd = (r.total_tokens::numeric / 1000000) * (
          select a.usd_per_million from studio.rates a
           where a.model = r.model and a.resolution in (coalesce(r.resolution, ''), '*')
           order by (a.resolution = '*') limit 1
        )
      where r.cost_usd is null and r.status = 'succeeded' and r.total_tokens is not null`,
  );
}

/**
 * Tie renders to ComfyUI runs: first by a task id seen in the run, otherwise
 * because the task was created while that run was executing. ComfyUI runs its
 * queue one prompt at a time, so a person's runs don't overlap. A matched render
 * becomes that person's, and a run saved under Project/Video/... files it there.
 * Projects set by hand are left alone.
 */
export async function matchComfy() {
  await q(
    `update studio.renders r set comfy_prompt_id = c.prompt_id, user_id = c.user_id
       from studio.comfy_runs c
      where r.comfy_prompt_id is null and r.id = any(c.task_ids)`,
  );
  await q(
    `update studio.renders r set comfy_prompt_id = c.prompt_id, user_id = c.user_id
       from studio.comfy_runs c
      where r.comfy_prompt_id is null
        and r.created_at between c.started_at - interval '5 seconds' and c.ended_at + interval '5 seconds'`,
  );
  const norm = (col: string) => `regexp_replace(lower(${col}), '[^a-z0-9]+', '', 'g')`;
  // New videos appear on their own under a project that already exists.
  await q(
    `insert into studio.videos (project_id, name)
     select distinct on (p.id, ${norm("c.video_hint")}) p.id, c.video_hint
       from studio.comfy_runs c
       join studio.projects p on ${norm("p.name")} = ${norm("c.project_hint")}
      where c.video_hint is not null
        and not exists (select 1 from studio.videos v where v.project_id = p.id and ${norm("v.name")} = ${norm("c.video_hint")})
     on conflict do nothing`,
  );
  // What the producer called it. Case, spaces and punctuation don't matter.
  const hay = norm(`coalesce(c.filename_prefix, '') || ' ' || coalesce(c.workflow, '') || ' ' || coalesce(c.outputs::text, '')`);
  // A naming rule beats a project's own name; the longest match wins in each.
  await q(
    `update studio.renders r
        set comfy_hint = c.filename_prefix,
            project_id = case when r.project_id is null then t.project_id else r.project_id end,
            video_id = case when r.project_id is null then t.video_id else r.video_id end,
            assigned_via = case when r.project_id is null and t.project_id is not null then 'comfy' else r.assigned_via end
       from studio.comfy_runs c
       left join lateral (
         select m.project_id,
                coalesce(m.video_id, (
                  select v.id from studio.videos v
                   where v.project_id = m.project_id
                     and length(${norm("v.name")}) >= 2
                     and position(${norm("v.name")} in ${hay}) > 0
                   order by length(${norm("v.name")}) desc limit 1
                )) as video_id
           from (
             select n.project_id, n.video_id, 2 as tier, length(${norm("n.match_text")}) as len
               from studio.name_rules n
              where position(${norm("n.match_text")} in ${hay}) > 0
             union all
             select p.id, null::uuid, 1, length(${norm("p.name")})
               from studio.projects p
              where p.status = 'active' and length(${norm("p.name")}) >= 3
                and position(${norm("p.name")} in ${hay}) > 0
           ) m
          order by m.tier desc, m.len desc limit 1
       ) t on true
      where r.comfy_prompt_id = c.prompt_id`,
  );
}

export async function syncAll(): Promise<{ keys: number; tasks: number; errors: string[] }> {
  const keys = await q<{ id: string; label: string; secret_enc: string }>(
    `select id, label, secret_enc from studio.api_keys where active`,
  );
  const rates = await q<Rate>(`select model, resolution, usd_per_million from studio.rates`);
  const admin = await q<{ id: string }>(`select id from studio.users where role = 'admin' and active order by created_at limit 1`);
  if (!admin.length) return { keys: keys.length, tasks: 0, errors: ["No active admin to file renders under."] };
  const owner = admin[0].id;
  let tasks = 0;
  const errors: string[] = [];
  for (const key of keys) {
    try {
      tasks += await syncKey(key, owner, rates);
      await q(`update studio.api_keys set last_sync_at = now(), last_sync_error = null where id = $1`, [key.id]);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push(`${key.label}: ${message}`);
      await q(`update studio.api_keys set last_sync_error = $2 where id = $1`, [key.id, message]);
    }
  }
  await matchComfy();
  return { keys: keys.length, tasks, errors };
}
