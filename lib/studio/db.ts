import { neon } from "@neondatabase/serverless";

/** The Neon connection. DATABASE_API is the pooled Postgres URL, server-only. */
let client: ReturnType<typeof neon> | null = null;

function db() {
  if (!client) {
    // Pasted connection strings often keep the quotes from a .env file.
    const url = process.env.DATABASE_API?.trim().replace(/^['"]|['"]$/g, "");
    if (!url) throw new Error("DATABASE_API is not set");
    client = neon(url);
  }
  return client;
}

export async function q<T = Record<string, any>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await db().query(text, params)) as T[];
}

export async function one<T = Record<string, any>>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows.length ? rows[0] : null;
}

export const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function getTimezone(): Promise<string> {
  const row = await one<{ value: string }>(`select value from studio.settings where key = 'timezone'`);
  return row?.value || "UTC";
}
