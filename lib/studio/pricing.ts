/**
 * Estimates only: the bill (bill.ts) replaces these once BytePlus charges.
 *
 * Seedance 2.x charges less per token when a render is given a reference
 * video ("V2V" on BytePlus's price list), but the input video's tokens are
 * counted too. The task list doesn't say whether there was a video, so it's
 * read from the tokens: a plain render uses about pixels × fps × seconds / 1024,
 * and one with a reference video comes out at roughly double that or more.
 */

// Pixels per frame for each tier. Every aspect ratio in a tier has about the
// same pixel count (720p 1:1 is 960×960), so the ratio doesn't matter here.
const PIXELS: Record<string, number> = {
  "480p": 854 * 480,
  "720p": 1280 * 720,
  "1080p": 1920 * 1080,
  "4k": 3840 * 2160,
};
const FPS = 24;
// Plain renders land at 0.95–1.05× the estimate, video ones at 1.9× and up.
const THRESHOLD = 1.4;

export function usedVideo(r: { resolution?: string | null; duration?: number | null; tokens?: number | null; fps?: number | null }): boolean | null {
  const pixels = PIXELS[(r.resolution || "").toLowerCase()];
  if (!pixels || !r.duration || r.duration <= 0 || r.tokens == null) return null;
  const plain = (pixels * (r.fps || FPS) * r.duration) / 1024;
  return r.tokens > plain * THRESHOLD;
}

/** The same guess in SQL, for renders (alias r) stored before it was kept. */
export const VIDEO_GUESS_SQL = `(r.total_tokens > ${THRESHOLD} * (case lower(r.resolution) ${Object.entries(PIXELS)
  .map(([k, v]) => `when '${k}' then ${v}`)
  .join(" ")} end) * ${FPS} * r.duration_s / 1024)`;

export type Rate = { model: string; resolution: string; usd_per_million: string; with_video_usd: string | null };

/** USD per million tokens for a render, or null when the model has no price. */
export function rateFor(rates: Rate[], model: string, resolution: string | null | undefined, video: boolean | null): number | null {
  const res = (resolution || "").toLowerCase();
  const rate = rates.find((r) => r.model === model && r.resolution === res) || rates.find((r) => r.model === model && r.resolution === "*");
  if (!rate) return null;
  return Number(video && rate.with_video_usd != null ? rate.with_video_usd : rate.usd_per_million);
}
