import { decryptSecret } from "./auth";
import { inferenceUsage, listApiKeys, sameKey, type AccessKey } from "./byteplus";
import { one, q } from "./db";

/**
 * BytePlus usage per API key → Neon. This is the one place BytePlus says which
 * key spent what, so it decides who spent what. Tokens are exact; dollars use
 * the cost per token BytePlus charged on matching renders that day, falling
 * back to the price list.
 */

const DAYS_BACK = 60;

export async function usageAccess(): Promise<AccessKey | null> {
  const row = await one<{ value: string }>(`select value from studio.settings where key = 'byteplus_access'`);
  if (!row) return null;
  const { id, secret } = JSON.parse(decryptSecret(row.value));
  return { id, secret };
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

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

  const end = new Date();
  const start = new Date(end.getTime() - DAYS_BACK * 86400000);
  const rows = await inferenceUsage(key, ymd(start), ymd(end));
  const withKey = rows.map((r) => ({
    day: r.day,
    auth_token: r.authToken,
    model: r.model,
    total_tokens: r.totalTokens,
    requests: r.requests,
    bp_key_id: keys.find((k) => sameKey(r.authToken, k.Key))?.Id ?? null,
  }));
  if (withKey.length) {
    await q(
      `insert into studio.key_usage (day, auth_token, model, total_tokens, requests, bp_key_id)
       select x.day, x.auth_token, x.model, x.total_tokens, x.requests, x.bp_key_id
         from jsonb_to_recordset($1::jsonb) as x(day date, auth_token text, model text, total_tokens bigint, requests int, bp_key_id bigint)
       on conflict (day, auth_token, model) do update set
         total_tokens = excluded.total_tokens, requests = excluded.requests, bp_key_id = excluded.bp_key_id`,
      [JSON.stringify(withKey)],
    );
  }
  await priceKeyUsage();
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
    `update studio.key_usage k set cost_usd = (k.total_tokens::numeric / 1000000) * coalesce(
       (select sum(r.cost_usd) / nullif(sum(r.total_tokens), 0) * 1000000 from studio.renders r
         where r.status = 'succeeded' and r.cost_usd is not null and r.total_tokens > 0
           and ${sameModel("r.model", "k.model")} and (r.created_at at time zone 'Asia/Singapore')::date = k.day),
       (select sum(r.cost_usd) / nullif(sum(r.total_tokens), 0) * 1000000 from studio.renders r
         where r.status = 'succeeded' and r.cost_usd is not null and r.total_tokens > 0 and ${sameModel("r.model", "k.model")}),
       (select min(a.usd_per_million) from studio.rates a where ${sameModel("a.model", "k.model")})
     )
     where k.total_tokens > 0`,
  );
  await q(`update studio.key_usage set cost_usd = 0 where total_tokens = 0`);
}
