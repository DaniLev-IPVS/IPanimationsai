import { createHash, createHmac } from "node:crypto";

/**
 * BytePlus control-plane calls (the same ones arkcli makes for `usage stats`
 * and the API key list), signed with an IAM access key. Signature: HMAC-SHA256
 * over a canonical request, scoped to date/region/service/request.
 */

const HOST = "ark.ap-southeast-1.byteplusapi.com";
const REGION = "ap-southeast-1";
const SERVICE = "ark";
const VERSION = "2024-01-01";

const sha256hex = (v: string) => createHash("sha256").update(v, "utf8").digest("hex");
const hmac = (key: Buffer | string, v: string) => createHmac("sha256", key).update(v, "utf8").digest();

export type AccessKey = { id: string; secret: string };

export async function arkAction<T = any>(action: string, body: unknown, key: AccessKey): Promise<T> {
  const payload = JSON.stringify(body ?? {});
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const date = now.slice(0, 8);
  const query = `Action=${encodeURIComponent(action)}&Version=${VERSION}`;
  const bodyHash = sha256hex(payload);

  const headers: Record<string, string> = {
    "content-type": "application/json",
    host: HOST,
    "x-content-sha256": bodyHash,
    "x-date": now,
  };
  const signed = Object.keys(headers).sort();
  const canonicalHeaders = signed.map((h) => `${h}:${headers[h]}\n`).join("");
  const canonicalRequest = ["POST", "/", query, canonicalHeaders, signed.join(";"), bodyHash].join("\n");
  const scope = `${date}/${REGION}/${SERVICE}/request`;
  const stringToSign = ["HMAC-SHA256", now, scope, sha256hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(key.secret, date), REGION), SERVICE), "request");
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  const res = await fetch(`https://${HOST}/?${query}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": headers["content-type"],
      "X-Content-Sha256": bodyHash,
      "X-Date": now,
      Authorization: `HMAC-SHA256 Credential=${key.id}/${scope}, SignedHeaders=${signed.join(";")}, Signature=${signature}`,
    },
    body: payload,
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

export type UsageRow = { day: string; authToken: string; model: string; totalTokens: number; requests: number };

/** Tokens and requests per day, per API key, per model. Same query as `arkcli usage stats --by apikey,model`. */
export async function inferenceUsage(key: AccessKey, start: string, end: string): Promise<UsageRow[]> {
  const result = await arkAction<{ Fields?: { Name: string }[]; Data?: unknown[][] }>(
    "GetInferenceUsage",
    {
      StartTime: start,
      EndTime: end,
      ProjectName: "default",
      QueryInterval: "Day",
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
    day: String(at(row, "Day")),
    authToken: String(at(row, "AuthToken") || ""),
    model: String(at(row, "ModelName") || ""),
    totalTokens: Number(at(row, "TotalTokens") || 0),
    requests: Number(at(row, "ReqCnt") || 0),
  }));
}

/** Usage shows a key as "abc****de123"; the key list as "abcdefgh*****…*****xyzde123". */
export function sameKey(authToken: string, maskedKey: string): boolean {
  const head = authToken.split("*")[0];
  const tail = authToken.split("*").pop() || "";
  return Boolean(head && tail) && maskedKey.startsWith(head) && maskedKey.endsWith(tail);
}
