import { createHash, createHmac } from "node:crypto";

/**
 * BytePlus control-plane calls (the same ones arkcli makes for `usage stats`
 * and the API key list), signed with an IAM access key. Signature: HMAC-SHA256
 * over a canonical request, scoped to date/region/service/request.
 */

export type AccessKey = { id: string; secret: string };

type Service = { host: string; region: string; service: string; version: string };

const ARK: Service = { host: "ark.ap-southeast-1.byteplusapi.com", region: "ap-southeast-1", service: "ark", version: "2024-01-01" };
// The account's bill: what BytePlus actually charged, line by line.
const BILLING: Service = { host: "open.byteplusapi.com", region: "ap-singapore-1", service: "billing", version: "2022-01-01" };

const sha256hex = (v: string) => createHash("sha256").update(v, "utf8").digest("hex");
const hmac = (key: Buffer | string, v: string) => createHmac("sha256", key).update(v, "utf8").digest();
const enc = (v: string) => encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

async function signedCall<T>(svc: Service, action: string, key: AccessKey, opts: { body?: unknown; query?: Record<string, string> }): Promise<T> {
  const method = opts.body === undefined ? "GET" : "POST";
  const payload = method === "POST" ? JSON.stringify(opts.body ?? {}) : "";
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const date = now.slice(0, 8);
  const params: Record<string, string> = { Action: action, Version: svc.version, ...(opts.query || {}) };
  const query = Object.keys(params).sort().map((k) => `${enc(k)}=${enc(params[k])}`).join("&");
  const bodyHash = sha256hex(payload);

  const headers: Record<string, string> = {
    "content-type": "application/json",
    host: svc.host,
    "x-content-sha256": bodyHash,
    "x-date": now,
  };
  const signed = Object.keys(headers).sort();
  const canonicalHeaders = signed.map((h) => `${h}:${headers[h]}\n`).join("");
  const canonicalRequest = [method, "/", query, canonicalHeaders, signed.join(";"), bodyHash].join("\n");
  const scope = `${date}/${svc.region}/${svc.service}/request`;
  const stringToSign = ["HMAC-SHA256", now, scope, sha256hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(key.secret, date), svc.region), svc.service), "request");
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  const res = await fetch(`https://${svc.host}/?${query}`, {
    method,
    cache: "no-store",
    headers: {
      "Content-Type": headers["content-type"],
      "X-Content-Sha256": bodyHash,
      "X-Date": now,
      Authorization: `HMAC-SHA256 Credential=${key.id}/${scope}, SignedHeaders=${signed.join(";")}, Signature=${signature}`,
    },
    body: method === "POST" ? payload : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // fall through to the error below
  }
  const error = json?.ResponseMetadata?.Error;
  if (!res.ok || error) {
    const detail = error ? `${error.Code}: ${error.Message}` : text.slice(0, 200);
    throw new Error(`BytePlus ${action} failed (${res.status}). ${detail}`);
  }
  return json.Result as T;
}

export const arkAction = <T = any>(action: string, body: unknown, key: AccessKey) => signedCall<T>(ARK, action, key, { body: body ?? {} });

export type BillLine = {
  BillDetailId: string;
  BillID: string;
  BillPeriod: string;
  Product: string;
  Element: string;
  ExpandField: string;
  ExpenseBeginTime: string;
  ExpenseEndTime: string;
  Count: string;
  Unit: string;
  PretaxAmount: string;
  OriginalBillAmount: string;
  Currency: string;
};

/**
 * Every charge on the bill for one month ("2026-11"), one line per render for
 * Seedance 2 and per few minutes for older models. Times are Singapore time.
 * A charge reaches the bill a few minutes to a couple of hours after the render.
 */
export async function listBillLines(key: AccessKey, period: string): Promise<BillLine[]> {
  const out: BillLine[] = [];
  for (let offset = 0; offset < 50000; offset += 100) {
    const result = await signedCall<{ List?: BillLine[]; Total?: number }>(BILLING, "ListBillDetail", key, {
      query: { BillPeriod: period, Limit: "100", Offset: String(offset), NeedRecordNum: "1", GroupTerm: "0", GroupPeriod: "2" },
    });
    const items = result.List || [];
    out.push(...items);
    if (items.length < 100 || out.length >= (result.Total || 0)) break;
  }
  return out;
}

export type ApiKeyItem = { Id: number; Name: string; Key: string; LastAccessTime?: string; Status?: string };

export async function listApiKeys(key: AccessKey): Promise<ApiKeyItem[]> {
  const out: ApiKeyItem[] = [];
  for (let page = 1; page <= 20; page++) {
    const result = await arkAction<{ Items?: ApiKeyItem[]; TotalCount?: number }>(
      "ListApiKeys",
      { ProjectName: "default", PageNumber: page, PageSize: 100 },
      key,
    );
    const items = result.Items || [];
    out.push(...items);
    if (!items.length || out.length >= (result.TotalCount || 0)) break;
  }
  return out;
}

export type UsageRow = { at: string; authToken: string; model: string; totalTokens: number; requests: number };

/**
 * Tokens and requests per hour, per API key, per model. BytePlus's Day and Hour
 * are Singapore time; `at` is the real moment that hour began.
 */
export async function inferenceUsage(key: AccessKey, start: string, end: string): Promise<UsageRow[]> {
  const result = await arkAction<{ Fields?: { Name: string }[]; Data?: unknown[][] }>(
    "GetInferenceUsage",
    {
      StartTime: start,
      EndTime: end,
      ProjectName: "default",
      QueryInterval: "Hour",
      Filters: [
        { Key: "ModelName", Values: [] },
        { Key: "ModelUnitID", Values: [] },
        { Key: "AuthToken", Values: [] },
        { Key: "BillingStatus", Values: [] },
      ],
    },
    key,
  );
  const names = (result.Fields || []).map((f) => f.Name);
  const at = (row: unknown[], name: string) => row[names.indexOf(name)];
  return (result.Data || []).map((row) => ({
    at: new Date(`${at(row, "Day")}T${String(at(row, "Hour")).padStart(2, "0")}:00:00+08:00`).toISOString(),
    authToken: String(at(row, "AuthToken") || ""),
    model: String(at(row, "ModelName") || ""),
    totalTokens: Number(at(row, "TotalTokens") || 0),
    requests: Number(at(row, "ReqCnt") || 0),
  }));
}

const WINDOW_DAYS = 5;
const DAY_MS = 86400000;
const SINGAPORE_MS = 8 * 3600000;
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * BytePlus only answers hourly usage a few days at a time, so longer spans go
 * out in 5-day pieces, counted from today in Singapore (its calendar). Rows
 * that differ only by a dimension we don't keep (billing status, model unit)
 * are added together: one row per hour, key and model.
 */
export async function inferenceUsageSince(key: AccessKey, daysBack: number, now = Date.now()): Promise<UsageRow[]> {
  const merged = new Map<string, UsageRow>();
  for (let back = 0; back < daysBack; back += WINDOW_DAYS) {
    const end = now + SINGAPORE_MS - back * DAY_MS;
    const start = end - (Math.min(WINDOW_DAYS, daysBack - back) - 1) * DAY_MS;
    for (const row of await inferenceUsage(key, ymd(start), ymd(end))) {
      const id = `${row.at}|${row.authToken}|${row.model}`;
      const seen = merged.get(id);
      if (seen) {
        seen.totalTokens += row.totalTokens;
        seen.requests += row.requests;
      } else {
        merged.set(id, { ...row });
      }
    }
  }
  return Array.from(merged.values());
}

/** Usage shows a key as "abc****de123"; the key list as "abcdefgh*****…*****xyzde123". */
export function sameKey(authToken: string, maskedKey: string): boolean {
  const head = authToken.split("*")[0];
  const tail = authToken.split("*").pop() || "";
  return Boolean(head && tail) && maskedKey.startsWith(head) && maskedKey.endsWith(tail);
}
