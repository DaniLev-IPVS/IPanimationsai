import { decryptSecret } from "./auth";
import { importBill } from "./bill";
import { inferenceUsageSince, listApiKeys, sameKey, type AccessKey } from "./byteplus";
import { pickRenders } from "./claim";
import { one, q } from "./db";

/**
 * BytePlus usage per API key → Neon, hour by hour. This is the one place
 * BytePlus says which key spent what, so it decides who spent what. Tokens are
 * exact. Dollars come from the bill: the bill lines whose token counts add up
 * to exactly that key's hour, otherwise that hour's billed cost per token.
 * Only hours the bill hasn't reached yet are estimated.
 */

const HISTORY_DAYS = 90;
// Late arrivals: BytePlus's report runs up to about 30 minutes behind.
const REFRESH_DAYS = 3;
const HISTORY_FLAG = "usage_history_loaded";

export async function usageAccess(): Promise<AccessKey | null> {
  const row = await one<{ value: string }>(`select value from studio.settings where key = 'byteplus_access'`);
  if (!row) return null;
  const { id, secret } = JSON.parse(decryptSecret(row.value));
  return { id, secret };
}

/**
 * Usage shows "ark" keys partly masked, so they match the key list directly.
 * Newer long-format keys come back as just "****", which can only be told
 * apart while the account has exactly one of them.
 */
function keyIdFor(authToken: string, keys: { Id: number; Key: string }[]): number | null {
  const match = keys.find((k) => sameKey(authToken, k.Key));
  if (match) return match.Id;
  if (authToken.replace(/\*/g, "")) return null;
  const longFormat = keys.filter((k) => !k.Key.startsWith("ark"));
  return longFormat.length === 1 ? longFormat[0].Id : null;
}

const setSetting = (key: string, value: string) =>
  q(
    `insert into studio.settings (key, value) values ($1, $2)
     on conflict (key) do update set value = excluded.value`,
    [key, value],
  );

export async function importKeyUsage(access?: AccessKey): Promise<{ keys: number; rows: number }> {
  const key = access || (await usageAccess());
  if (!key) return { keys: 0, rows: 0 };

  const keys = await listApiKeys(key);
  for (const k of keys) {
    await q(
      `insert into studio.bp_keys (id, name, masked_key, last_access, status) values ($1, $2, $3, $4, $5)
       on conflict (id) do update set name = excluded.name, masked_key = excluded.masked_key,
         last_access = excluded.last_access, status = excluded.status`,
      [k.Id, k.Name, k.Key, k.LastAccessTime || null, k.Status || null],
    );
  }

  const loaded = await one(`select 1 from studio.settings where key = $1`, [HISTORY_FLAG]);
  const rows = await inferenceUsageSince(key, loaded ? REFRESH_DAYS : HISTORY_DAYS);
  const withKey = rows.map((r) => ({
    at: r.at,
    auth_token: r.authToken,
    model: r.model,
    total_tokens: r.totalTokens,
    requests: r.requests,
    bp_key_id: keyIdFor(r.authToken, keys),
  }));
  if (withKey.length) {
    await q(
      `insert into studio.key_usage_hourly (at, auth_token, model, total_tokens, requests, bp_key_id)
       select x.at, x.auth_token, x.model, x.total_tokens, x.requests, x.bp_key_id
         from jsonb_to_recordset($1::jsonb) as x(at timestamptz, auth_token text, model text, total_tokens bigint, requests int, bp_key_id bigint)
       on conflict (at, auth_token, model) do update set
         total_tokens = excluded.total_tokens, requests = excluded.requests, bp_key_id = excluded.bp_key_id`,
      [JSON.stringify(withKey)],
    );
  }
  // The access key may not be allowed to read the bill; usage still works.
  try {
    await importBill(key);
    await q(`delete from studio.settings where key = 'bill_error'`);
  } catch (e) {
    await setSetting("bill_error", (e instanceof Error ? e.message : String(e)).slice(0, 500));
  }
  await priceKeyUsage();
  await claimRendersFromUsage();
  if (!loaded) await setSetting(HISTORY_FLAG, new Date().toISOString());
  await q(
    `insert into studio.settings (key, value) values ('usage_synced_at', now()::text)
     on conflict (key) do update set value = excluded.value`,
  );
  return { keys: keys.length, rows: withKey.length };
}

const EDGE_MS = 5 * 60000;
const HOUR_MS = 3600000;

/**
 * The render list doesn't say which key made a render, so it's worked out from
 * each producer key's hourly usage (see pickRenders). A ComfyUI run is stronger
 * evidence, so those renders are left alone. Hours that don't add up to exactly
 * one set stay with the admin; the key's Spent total is right either way.
 */
export async function claimRendersFromUsage() {
  const usage = await q<{ at: string; model: string; total_tokens: string; requests: number; owner: string }>(
    `select k.at, k.model, k.total_tokens, k.requests, b.owner_id as owner
       from studio.key_usage_hourly k
       join studio.bp_keys b on b.id = k.bp_key_id
       join studio.users u on u.id = b.owner_id
      where u.role <> 'admin' and k.total_tokens > 0 and k.at >= now() - interval '8 days'
      order by k.at`,
  );
  if (!usage.length) return;
  const [renders, admins] = await Promise.all([
    q<{ id: string; model: string; total_tokens: string; user_id: string; updated_at: string }>(
      `select id, model, total_tokens, user_id, updated_at from studio.renders
        where status = 'succeeded' and total_tokens > 0 and comfy_prompt_id is null and updated_at >= now() - interval '9 days'`,
    ),
    q<{ id: string }>(`select id from studio.users where role = 'admin'`),
  ]);
  const adminIds = new Set(admins.map((a) => a.id));
  const used = new Set<string>();
  for (const u of usage) {
    const from = Date.parse(u.at) - EDGE_MS;
    const to = Date.parse(u.at) + HOUR_MS + EDGE_MS;
    const candidates = renders
      .filter((r) => {
        const finished = Date.parse(r.updated_at);
        const sameModelName = r.model === u.model || new RegExp(`^${u.model}-[0-9]{6}$`).test(r.model);
        return !used.has(r.id) && sameModelName && finished >= from && finished < to && (r.user_id === u.owner || adminIds.has(r.user_id));
      })
      .map((r) => ({ id: r.id, tokens: Number(r.total_tokens), mine: r.user_id === u.owner, finished: Date.parse(r.updated_at) }));
    const ids = pickRenders(candidates, u.requests, Number(u.total_tokens));
    if (!ids) continue;
    ids.forEach((id) => used.add(id));
    await q(`update studio.renders set user_id = $1 where id = any($2::text[]) and user_id <> $1`, [u.owner, ids]);
  }
}

/** "dreamina-seedance-2-5" in usage is "dreamina-seedance-2-5-260628" in renders and prices. */
const sameModel = (full: string, short: string) => `(${full} = ${short} or ${full} ~ ('^' || ${short} || '-[0-9]{6}$'))`;

const PRICE_DAYS = 100;

export async function priceKeyUsage() {
  const [usage, lines] = await Promise.all([
    q<{ at: string; auth_token: string; model: string; total_tokens: string; requests: number }>(
      `select at, auth_token, model, total_tokens, requests from studio.key_usage_hourly
        where total_tokens > 0 and at >= now() - interval '${PRICE_DAYS} days' order by at, total_tokens desc`,
    ),
    q<{ id: string; model: string; tokens: string; amount_usd: string; begin_at: string }>(
      `select id, model, tokens, amount_usd, begin_at from studio.bill_lines
        where model is not null and tokens > 0 and begin_at >= now() - interval '${PRICE_DAYS + 1} days' order by begin_at`,
    ),
  ]);
  const inHour = (u: { at: string; model: string }, l: { model: string; begin_at: string }, edge = EDGE_MS) => {
    const t = Date.parse(l.begin_at);
    return l.model === u.model && t >= Date.parse(u.at) - edge && t < Date.parse(u.at) + HOUR_MS + edge;
  };
  const priced: { at: string; auth_token: string; model: string; cost: number }[] = [];
  const rest: typeof usage = [];

  // Exact: the bill lines that add up to this key's hour are its charges.
  // Inside the hour first, so a neighbouring hour can't take a line that
  // belongs here; then a few minutes either side for what's left.
  const used = new Set<string>();
  let todo = usage;
  for (const edge of [0, EDGE_MS]) {
    const next: typeof usage = [];
    for (const u of todo) {
      const near = lines.filter((l) => !used.has(l.id) && inHour(u, l, edge));
      const ids = pickRenders(
        near.map((l) => ({ id: l.id, tokens: Number(l.tokens), mine: false, finished: Date.parse(l.begin_at) })),
        u.requests,
        Number(u.total_tokens),
      );
      if (!ids) {
        next.push(u);
        continue;
      }
      ids.forEach((id) => used.add(id));
      priced.push({ ...u, cost: near.filter((l) => ids.includes(l.id)).reduce((sum, l) => sum + Number(l.amount_usd), 0) });
    }
    todo = next;
  }
  rest.push(...todo);
  // Otherwise (renders billed together, older models billed in batches): the
  // bill lines no exact hour took are handed to the hour they fall in, split
  // by tokens when several keys used that model then. Every billed dollar
  // lands somewhere, so the totals add up to the bill.
  const share = new Map<(typeof usage)[number], number>();
  for (const l of lines) {
    if (used.has(l.id)) continue;
    let rows = rest.filter((u) => inHour(u, l, 0));
    if (!rows.length) rows = rest.filter((u) => inHour(u, l));
    const tokens = rows.reduce((sum, u) => sum + Number(u.total_tokens), 0);
    for (const u of rows) share.set(u, (share.get(u) || 0) + (Number(l.amount_usd) * Number(u.total_tokens)) / tokens);
  }
  share.forEach((cost, u) => priced.push({ ...u, cost }));

  await q(`update studio.key_usage_hourly set cost_source = null where at >= now() - interval '${PRICE_DAYS} days'`);
  if (priced.length) {
    await q(
      `update studio.key_usage_hourly k set cost_usd = x.cost, cost_source = 'bill'
         from jsonb_to_recordset($1::jsonb) as x(at timestamptz, auth_token text, model text, cost numeric)
        where k.at = x.at and k.auth_token = x.auth_token and k.model = x.model`,
      [JSON.stringify(priced.map(({ at, auth_token, model, cost }) => ({ at, auth_token, model, cost })))],
    );
  }
  // Not on the bill yet: estimated from that hour's renders, then the price list.
  await q(
    `update studio.key_usage_hourly k set cost_source = 'estimate', cost_usd = (k.total_tokens::numeric / 1000000) * coalesce(
       (select sum(r.cost_usd) / nullif(sum(r.total_tokens), 0) * 1000000 from studio.renders r
         where r.status = 'succeeded' and r.cost_usd is not null and r.total_tokens > 0 and ${sameModel("r.model", "k.model")}
           and r.updated_at >= k.at - interval '5 minutes' and r.updated_at < k.at + interval '65 minutes'),
       (select min(a.usd_per_million) from studio.rates a where ${sameModel("a.model", "k.model")})
     )
     where k.total_tokens > 0 and k.cost_source is null and k.at >= now() - interval '${PRICE_DAYS} days'`,
  );
  await q(`update studio.key_usage_hourly set cost_usd = 0, cost_source = 'bill' where total_tokens = 0`);
}
