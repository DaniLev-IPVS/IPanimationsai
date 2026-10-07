/**
 * Where the animations live: a public Cloudflare R2 bucket behind a custom
 * domain (e.g. https://data.ipanimations.ai). Content references files by
 * object key ("reel/degen-future-trailer.mp4"); this turns a key into a URL.
 *
 * NEXT_PUBLIC_ so the browser can build the URL too — it is a public address,
 * not a secret. The R2 *write* credentials are separate and never reach the page.
 */

const base = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "").replace(/\/+$/, "");

/** True once the bucket's public URL is configured. */
export const mediaConfigured = base.length > 0;

/** Public URL for an R2 object key, or undefined if R2 isn't configured. */
export function mediaUrl(key: string | undefined): string | undefined {
  if (!key || !mediaConfigured) return undefined;
  return `${base}/${key.replace(/^\/+/, "")}`;
}
