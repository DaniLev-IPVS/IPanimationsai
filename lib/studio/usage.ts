import { decryptSecret } from "./auth";
import { inferenceUsageSince, listApiKeys, sameKey, type AccessKey } from "./byteplus";
import { one, q } from "./db";

/**
 * BytePlus usage per API key → Neon, hour by hour. This is the one place
 * BytePlus says which key spent what, so it decides who spent what. Tokens are
 * exact; dollars use the cost per token BytePlus charged on matching renders
 * that day, falling back to the price list.
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
  await priceKeyUsage();
  if (!loaded) await setSetting(HISTORY_FLAG, new Date().toISOString());
  await q(
    `insert into studio.settings (key, value) values ('usage_synced_at', now()::text)
     on conflict (key) do update set value = excluded.value`,
  );
  return { keys: keys.length, rows: withKey.length };
}

/** "dreamina-seedance-2-5" in usage is "dreamina-seedance-2-5-260628" in renders and prices. */
const sameModel = (full: string, short: string) => `(${full} = ${short} or ${full} ~ ('^' || ${short} || '-[0-9]{6}$'))`;

export async function priceKeyUsage() {
  await q(
    `update studio.key_usage_hourly k set cost_usd = (k.total_tokens::numeric / 1000000) * coalesce(
       (select sum(r.cost_usd) / nullif(sum(r.total_tokens), 0) * 1000000 from studio.renders r
         where r.status = 'succeeded' and r.cost_usd is not null and r.total_tokens > 0
           and ${sameModel("r.model", "k.model")}
           and (r.created_at at time zone 'Asia/Singapore')::date = (k.at at time zone 'Asia/Singapore')::date),
       (select sum(r.cost_usd) / nullif(sum(r.total_tokens), 0) * 1000000 from studio.renders r
         where r.status = 'succeeded' and r.cost_usd is not null and r.total_tokens > 0 and ${sameModel("r.model", "k.model")}),
       (select min(a.usd_per_million) from studio.rates a where ${sameModel("a.model", "k.model")})
     )
     where k.total_tokens > 0`,
  );
  await q(`update studio.key_usage_hourly set cost_usd = 0 where total_tokens = 0`);
}
