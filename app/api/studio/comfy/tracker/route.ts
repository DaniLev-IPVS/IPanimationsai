import { NextResponse } from "next/server";
import { getUser, newToken, sha256 } from "@/lib/studio/auth";
import { q } from "@/lib/studio/db";
import { buildComfyNode } from "@/lib/studio/comfy-node";

/**
 * The "Download my tracker" button in Settings. Tokens are stored hashed, so
 * each download makes a fresh one and the previous file stops working. POST,
 * so that only a real click on our own page (SameSite cookie) can replace it.
 */

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/studio/login", req.url), 303);

  const token = `ipc_${newToken(24)}`;
  await q(`update studio.users set comfy_token_hash = $2 where id = $1`, [user.id, sha256(token)]);

  const origin = process.env.NODE_ENV === "production" ? "https://ipanimations.ai" : new URL(req.url).origin;
  return new NextResponse(buildComfyNode(token, origin), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="ipa_studio_tracker.py"',
      "Cache-Control": "no-store",
    },
  });
}
