import { listBillLines, type AccessKey, type BillLine } from "./byteplus";
import { pickRenders } from "./claim";
import { one, q } from "./db";
import { VIDEO_GUESS_SQL } from "./pricing";

/**
 * BytePlus's bill → Neon. This is what the account was actually charged, so it
 * decides what a render cost. Seedance 2 gets one line per render, with the
 * render's exact token count, a minute or so after it finishes; older models
 * are billed in 5-minute batches. Until a render's line arrives (a few minutes
 * to a couple of hours), its price is an estimate from the price list.
 */

const HISTORY_MONTHS = 6;
const HISTORY_FLAG = "bill_history_loaded";
const SINGAPORE_MS = 8 * 3600000;
const MIN = 60000;
// Matching looks back this far; older renders keep the bill price they got.
const MATCH_DAYS = 100;

const singapore = (t: string) => new Date(`${t.replace(" ", "T")}+08:00`).toISOString();

function months(back: number, now = Date.now()): string[] {
  const d = new Date(now + SINGAPORE_MS);
  const out: string[] = [];
  for (let i = 0; i < back; i++) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push(m.toISOString().slice(0, 7));
  }
  return out;
}

function toRow(l: BillLine) {
  const el = l.Element || "";
  const count = Number(l.Count);
  const tokens = /^k ?tokens$/i.test(l.Unit) ? Math.round(count * 1000) : /^tokens$/i.test(l.Unit) ? Math.round(count) : null;
  return {
    id: l.BillDetailId && l.BillDetailId !== "-" ? l.BillDetailId : `${l.BillID}|${el}|${l.ExpenseBeginTime}`,
    bill_period: l.BillPeriod,
    begin_at: singapore(l.ExpenseBeginTime),
    end_at: l.ExpenseEndTime ? singapore(l.ExpenseEndTime) : null,
    product: l.Product,
    element: el,
    model: l.ExpandField || null,
    video_in: el.includes("non-video-in") ? false : el.includes("video-in") ? true : null,
    tokens,
    amount_usd: Number(l.PretaxAmount || 0),
    list_usd: Number(l.OriginalBillAmount || 0),
  };
}

export async function importBill(key: AccessKey): Promise<number> {
  const loaded = await one(`select 1 from studio.settings where key = $1`, [HISTORY_FLAG]);
  const day = new Date(Date.now() + SINGAPORE_MS).getUTCDate();
  // Last month's bill can still change for the first few days of this one.
  const periods = loaded ? months(day <= 3 ? 2 : 1) : months(HISTORY_MONTHS);
  let n = 0;
  for (const period of periods) {
    const rows = (await listBillLines(key, period)).map(toRow);
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      await q(
        `insert into studio.bill_lines (id, bill_period, begin_at, end_at, product, element, model, video_in, tokens, amount_usd, list_usd)
         select x.id, x.bill_period, x.begin_at, x.end_at, x.product, x.element, x.model, x.video_in, x.tokens, x.amount_usd, x.list_usd
           from jsonb_to_recordset($1::jsonb) as x(id text, bill_period text, begin_at timestamptz, end_at timestamptz, product text,
             element text, model text, video_in boolean, tokens bigint, amount_usd numeric, list_usd numeric)
         on conflict (id) do update set amount_usd = excluded.amount_usd, list_usd = excluded.list_usd,
           tokens = excluded.tokens, end_at = excluded.end_at`,
        [JSON.stringify(chunk)],
      );
    }
    n += rows.length;
  }
  await matchBillToRenders();
  if (!loaded) {
    await q(
      `insert into studio.settings (key, value) values ($1, now()::text) on conflict (key) do update set value = excluded.value`,
      [HISTORY_FLAG],
    );
  }
  return n;
}

/** "dreamina-seedance-2-5" on the bill is "dreamina-seedance-2-5-260628" in renders. */
export const sameModelName = (full: string, short: string) => full === short || new RegExp(`^${short}-[0-9]{6}$`).test(full);

/**
 * Tie each bill line to the render(s) it charged for: same model, finished
 * within the line's 30 seconds, and token counts that add up exactly (renders
 * finishing together share a line). A render then costs exactly its share of
 * that line. A render that can't be pinned to one line costs its tokens at the
 * rate the bill charged for that model, resolution and video input right then.
 */
export async function matchBillToRenders() {
  const [lines, renders, taken] = await Promise.all([
    q<{ id: string; model: string; tokens: string; begin_at: string; end_at: string | null }>(
      `select id, model, tokens, begin_at, end_at from studio.bill_lines
        where model is not null and tokens > 0 and begin_at >= now() - interval '${MATCH_DAYS} days' order by begin_at`,
    ),
    q<{ id: string; model: string; total_tokens: string; updated_at: string }>(
      `select id, model, total_tokens, updated_at from studio.renders
        where status = 'succeeded' and total_tokens > 0 and bill_line_id is null and updated_at is not null
          and updated_at >= now() - interval '${MATCH_DAYS + 1} days'`,
    ),
    q<{ bill_line_id: string; tokens: string }>(
      `select bill_line_id, sum(total_tokens) as tokens from studio.renders where bill_line_id is not null group by 1`,
    ),
  ]);
  const used = new Map(taken.map((t) => [t.bill_line_id, Number(t.tokens)]));
  const free = new Set(renders.map((r) => r.id));
  const links: { id: string; line: string }[] = [];

  for (const l of lines) {
    const left = Number(l.tokens) - (used.get(l.id) || 0);
    if (left <= 0) continue;
    const begin = Date.parse(l.begin_at);
    const end = l.end_at ? Math.min(Date.parse(l.end_at), begin + 10 * MIN) : begin + MIN;
    const near = renders
      .filter((r) => free.has(r.id) && sameModelName(r.model, l.model))
      .map((r) => ({ id: r.id, tokens: Number(r.total_tokens), finished: Date.parse(r.updated_at), mine: false }))
      .filter((r) => r.finished >= begin - 1.5 * MIN && r.finished <= end + 1.5 * MIN);
    let ids: string[] | null = null;
    const exact = near.filter((r) => r.tokens === left).sort((a, b) => Math.abs(a.finished - begin) - Math.abs(b.finished - begin));
    if (exact.length) ids = [exact[0].id];
    for (let n = 2; !ids && n <= Math.min(12, near.length); n++) ids = pickRenders(near, n, left);
    if (!ids) continue;
    for (const id of ids) {
      free.delete(id);
      links.push({ id, line: l.id });
    }
    used.set(l.id, Number(l.tokens));
  }

  if (links.length) {
    await q(
      `update studio.renders r set bill_line_id = x.line
         from jsonb_to_recordset($1::jsonb) as x(id text, line text) where r.id = x.id`,
      [JSON.stringify(links)],
    );
  }
  await q(
    `update studio.renders r
        set cost_usd = l.amount_usd * r.total_tokens / l.tokens, cost_source = 'bill',
            video_input = coalesce(l.video_in, r.video_input)
       from studio.bill_lines l
      where r.bill_line_id = l.id and l.tokens > 0
        and (r.cost_source is distinct from 'bill' or r.cost_usd is distinct from l.amount_usd * r.total_tokens / l.tokens)`,
  );

  const tier = (col: string) => `(case when ${col} ilike '%1080p%' then '1080p' when ${col} ilike '%4k%' then '4k' when ${col} ilike '%480p%' or ${col} ilike '%720p%' then 'low' end)`;
  await q(
    `update studio.renders r set cost_usd = r.total_tokens * x.rate, cost_source = 'bill_rate', video_input = coalesce(r.video_input, x.video)
       from studio.renders r2
       cross join lateral (
         select sum(l.amount_usd) / nullif(sum(l.tokens), 0) as rate, bool_and(l.video_in) as video
           from studio.bill_lines l
          where l.model is not null and l.tokens > 0
            and (r2.model = l.model or r2.model ~ ('^' || l.model || '-[0-9]{6}$'))
            and l.begin_at >= r2.updated_at - interval '30 minutes' and l.begin_at <= r2.updated_at + interval '60 minutes'
            and (${tier("l.element")} is null or ${tier("l.element")} = ${tier("r2.resolution")})
            and (l.video_in is null or l.video_in = coalesce(r2.video_input, ${VIDEO_GUESS_SQL.replace(/\br\./g, "r2.")}, false))
       ) x
      where r.id = r2.id and r2.bill_line_id is null and r2.status = 'succeeded' and r2.total_tokens > 0
        and r2.updated_at >= now() - interval '${MATCH_DAYS + 1} days' and x.rate is not null`,
  );
}
