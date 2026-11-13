import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { LANG_NAME, type Lang } from "./i18n";
import type { Project } from "./proposals";

/**
 * Translates what comes from Notion (briefs, ideas, scripts) for the team.
 *
 * Claude does the translating, called with the studio's own Anthropic key
 * (ANTHROPIC_KEY_IPANI, set on Vercel and in .env.local). Each project's text
 * is translated once per language and kept, keyed by the text itself, so it
 * is only sent again when someone changes it in Notion.
 *
 * Nothing here throws: a project that can't be translated stays in English.
 */

const MODEL = process.env.STUDIO_TRANSLATE_MODEL || "claude-opus-5-5";

const instructions = (language: string) =>
  [
    `You translate text for an animation studio's internal production tool into ${language}.`,
    "The reader is an animator who has to understand a client's request and estimate the work.",
    "",
    "The input is a JSON array of strings. Reply with one JSON array of strings and nothing else:",
    "the same number of items, in the same order, each item the translation of the item at that position.",
    "",
    "Rules:",
    "- Translate plainly and naturally, the way a colleague would write it. Do not add or drop information.",
    "- Keep unchanged: names of people, companies, products and software, web addresses, numbers, prices,",
    "  time codes such as 0:00 to 0:03, and the names of Notion statuses.",
    "- Keep every line break and every leading bullet character exactly where it is.",
    '- Lines of a video script: translate the description of the picture. For the voice-over (after "VO:"),',
    '  keep "VO:" and give the original English line followed by its translation in parentheses,',
    "  because the voice-over is recorded in English.",
    "- On-screen labels written in capitals stay in English, followed by the translation in parentheses.",
    `- An item that is already in ${language}, or is only a name or a number, comes back unchanged.`,
  ].join("\n");

/** One model call. Returns null (and logs why) when the result can't be used. */
async function callModel(apiKey: string, lang: Lang, texts: string[]): Promise<string[] | null> {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 120_000 });
  try {
    // If the model declines a text, the API re-runs the request on its default
    // fallback model inside the same call, so one odd brief doesn't block a page.
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: instructions(LANG_NAME[lang]),
      messages: [{ role: "user", content: JSON.stringify(texts) }],
    });
    if (response.stop_reason !== "end_turn") {
      console.error("[studio/translate] stopped early:", response.stop_reason);
      return null;
    }
    const out = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const parsed: unknown = JSON.parse(out.slice(out.indexOf("["), out.lastIndexOf("]") + 1));
    if (!Array.isArray(parsed) || parsed.length !== texts.length || !parsed.every((s) => typeof s === "string")) {
      console.error("[studio/translate] reply didn't match the input:", texts.length, "items sent");
      return null;
    }
    return parsed as string[];
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error("[studio/translate] Anthropic refused ANTHROPIC_KEY_IPANI:", err.message);
    } else if (err instanceof Anthropic.RateLimitError) {
      console.error("[studio/translate] rate limited:", err.message);
    } else if (err instanceof Anthropic.APIError) {
      console.error(`[studio/translate] API error ${err.status}:`, err.message);
    } else {
      console.error("[studio/translate] failed:", err);
    }
    return null;
  }
}

/**
 * The same strings in another language, or null if they couldn't be translated.
 * A good result is remembered; a failure is not, so the next visit tries again.
 */
async function translateTexts(texts: string[], lang: Lang): Promise<string[] | null> {
  // Only strings with letters in them are worth sending; "$500 – $5000" is not.
  const wanted = texts.map((t, i) => (/[A-Za-z\u00C0-\u024F\u0400-\u04FF]/.test(t) ? i : -1)).filter((i) => i >= 0);
  if (!wanted.length) return texts;
  const apiKey = process.env.ANTHROPIC_KEY_IPANI;
  if (!apiKey) {
    console.error("[studio/translate] ANTHROPIC_KEY_IPANI is not set.");
    return null;
  }
  const batch = wanted.map((i) => texts[i]);
  const key = createHash("sha256").update(JSON.stringify(batch)).digest("hex");
  const cached = unstable_cache(
    async () => {
      const result = await callModel(apiKey, lang, batch);
      if (!result) throw new Error("not translated"); // keeps the failure out of the cache
      return result;
    },
    ["studio-translate-v1", MODEL, lang, key],
    { revalidate: false },
  );
  let translated: string[];
  try {
    translated = await cached();
  } catch {
    return null;
  }
  const out = [...texts];
  wanted.forEach((index, n) => {
    out[index] = translated[n];
  });
  return out;
}

/** Every piece of client text on one project, in a fixed order, and how to put it back. */
function fields(project: Project): { read: () => string[]; write: (values: string[]) => void } {
  const slots: { get: () => string; set: (v: string) => void }[] = [];
  const slot = <T extends object>(obj: T, key: keyof T) =>
    slots.push({ get: () => String(obj[key] ?? ""), set: (v) => ((obj as any)[key] = v) });
  const list = (lines: string[]) =>
    lines.forEach((_, i) => slots.push({ get: () => lines[i], set: (v) => (lines[i] = v) }));

  slot(project, "name");
  slot(project, "who");
  slot(project, "needs");
  slot(project, "why");
  slot(project, "usedFor");
  slot(project, "budget");
  list(project.notes);
  for (const idea of project.ideas) {
    slot(idea, "name");
    slot(idea, "idea");
    list(idea.details);
  }
  return {
    read: () => slots.map((s) => s.get()),
    write: (values) => slots.forEach((s, i) => s.set(values[i])),
  };
}

/**
 * Translates the board in place, one project at a time and all at once.
 * Returns false if any project had to stay in English.
 */
export async function translateBoard(
  board: { waiting: Project[]; sent: Project[] },
  lang: Lang,
): Promise<boolean> {
  if (lang === "en") return true;
  const results = await Promise.all(
    [...board.waiting, ...board.sent].map(async (project) => {
      const f = fields(project);
      const translated = await translateTexts(f.read(), lang);
      if (translated) f.write(translated);
      return Boolean(translated);
    }),
  );
  return results.every(Boolean);
}
