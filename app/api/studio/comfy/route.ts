import { NextResponse } from "next/server";
import { sha256 } from "@/lib/studio/auth";
import { one, q } from "@/lib/studio/db";
import { matchComfy } from "@/lib/studio/sync";

/**
 * Where the ComfyUI tracker (lib/studio/comfy-node.ts) reports finished runs,
 * plus a heartbeat with no runs. The token inside each person's downloaded
 * file says whose runs these are.
 */

export const runtime = "nodejs";

type Run = {
  prompt_id?: unknown;
  workflow?: unknown;
  filename_prefix?: unknown;
  started_at?: unknown;
  ended_at?: unknown;
  status?: unknown;
  task_ids?: unknown;
  outputs?: unknown;
};

const str = (v: unknown, max = 300) => (typeof v === "string" && v ? v.slice(0, max) : null);
const when = (v: unknown) => (typeof v === "number" && v > 0 ? new Date(v).toISOString() : null);

/** Project/Video/shot_ → the two folders. %date%-style tokens aren't names. */
function hints(prefix: string | null) {
  const parts = (prefix || "")
    .split(/[\\/]/)
    .map((p) => p.trim())
    .filter(Boolean);
  const folders = parts.slice(0, -1).filter((p) => p.indexOf("%") < 0);
  return { project: folders[0] || null, video: folders[1] || null };
}

export async function POST(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const user = token
    ? await one<{ id: string }>(`select id from studio.users where comfy_token_hash = $1 and active`, [sha256(token)])
    : null;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { runs?: Run[] } | null;
  const runs = Array.isArray(body?.runs) ? body!.runs!.slice(0, 200) : [];

  const rows = runs
    .filter((r) => typeof r.prompt_id === "string" && r.prompt_id)
    .map((r) => {
      const prefix = str(r.filename_prefix);
      const hint = hints(prefix);
      return {
        prompt_id: str(r.prompt_id, 100),
        workflow: str(r.workflow),
        filename_prefix: prefix,
        project_hint: hint.project,
        video_hint: hint.video,
        started_at: when(r.started_at),
        ended_at: when(r.ended_at),
        status: str(r.status, 40),
        task_ids: Array.isArray(r.task_ids) ? r.task_ids.filter((t) => typeof t === "string").slice(0, 100) : [],
        outputs: Array.isArray(r.outputs) ? r.outputs.filter((o) => typeof o === "string").slice(0, 50) : [],
      };
    });

  if (rows.length) {
    await q(
      `insert into studio.comfy_runs
         (prompt_id, user_id, workflow, filename_prefix, project_hint, video_hint, started_at, ended_at, status, task_ids, outputs)
       select x.prompt_id, $2::uuid, x.workflow, x.filename_prefix, x.project_hint, x.video_hint, x.started_at, x.ended_at, x.status,
              array(select jsonb_array_elements_text(x.task_ids)), x.outputs
         from jsonb_to_recordset($1::jsonb) as x(
           prompt_id text, workflow text, filename_prefix text, project_hint text, video_hint text,
           started_at timestamptz, ended_at timestamptz, status text, task_ids jsonb, outputs jsonb)
       on conflict (prompt_id) do update set
         ended_at = excluded.ended_at, status = excluded.status, task_ids = excluded.task_ids, outputs = excluded.outputs
       where studio.comfy_runs.user_id = $2::uuid`,
      [JSON.stringify(rows), user.id],
    );
    await matchComfy();
  }
  await q(`update studio.users set comfy_last_seen = now() where id = $1`, [user.id]);
  return NextResponse.json({ ok: true, received: rows.length });
}
