/**
 * Single source of truth for every piece of copy, link and option on the page.
 * Change things here, not in the components.
 */

export const brand = {
  nameBig: "IP VENTURES",
  nameSmall: "animations",
  domain: "ipanimations.ai",
  email: "hello@ipanimations.ai",
  // TEMPORARY placeholder mark. Drop the real IP Ventures file into
  // public/brand/ and point this at it — nothing else needs to change.
  logo: "/brand/placeholder-mark.svg",
  logoIsPlaceholder: true,
};

export const hero = {
  label: "01 / 04 — THE OFFER",
  headline: "Animation that makes people move.",
  sub: "Frame by frame, rigged, or AI — we make the work people watch to the end and then act on. Click, follow, buy. Built by animators who were drawing long before the machines could.",
  formLead: "Tell us what you need animated. You'll hear back within one business day.",
};

/* ───────────────────────────────────────────────────────────────────────────
   PLACEHOLDER TESTIMONIALS.
   Structural stand-ins that demonstrate the shape of a good testimonial.
   They are NOT real and must be replaced with real, attributable quotes
   before this page sees paid traffic.
   ─────────────────────────────────────────────────────────────────────────── */
export const testimonials = {
  label: "02 / 04 — WHAT THEY SAY AFTER",
  lead: "Nobody hires an animation studio twice because the animation was pretty.",
  isPlaceholder: true,
  items: [
    {
      quote:
        "We'd been running the same three ads for eight months because nothing we tested beat them. Their first cut beat all three in a week. We've since replaced the whole account.",
      name: "[Name]",
      role: "Head of Growth",
      company: "[Company]",
      work: "six vertical ads, rigged",
    },
    {
      quote:
        "I'd spent two months prompting my way to something usable and never got there. What came back in the first round was the thing I'd been describing badly the whole time.",
      name: "[Name]",
      role: "Founder",
      company: "[Company]",
      work: "60-second AI-animated explainer",
    },
    {
      quote:
        "Four finished cuts a week, every week, and I never once got a file I had to send back. I can't explain how rare that is.",
      name: "[Name]",
      role: "Creative Director",
      company: "[Agency]",
      work: "ongoing, mixed technique",
    },
    {
      quote:
        "We came for one ad and stayed for the character. They built her, and now she's the only part of our marketing people actually recognise.",
      name: "[Name]",
      role: "CMO",
      company: "[Company]",
      work: "character design + 12-episode series, frame by frame",
    },
  ],
};

export type Technique = "FRAME BY FRAME" | "RIGGED" | "AI";

export type ReelItem = {
  slot: string;
  technique: Technique;
  blurb: string;
  /** YouTube id. null = slot still empty, renders a live placeholder card. */
  youtubeId: string | null;
  /** Local muted preview loop (mp4/webm) once one has been cut. */
  preview?: string | null;
};

/* TEMPORARY reel slots — 2 horizontal features + 6 vertical.
   Fill youtubeId to light a slot up; everything else is automatic. */
export const reel = {
  label: "03 / 04 — THE WORK",
  lead: "Frame by frame. Rigged. AI. Same standard.",
  closer:
    "The AI work isn't a prompt and a prayer. It's storyboarded, designed and directed like everything else here — the model just replaces the in-between. That's why it doesn't look like everyone else's.",
  features: [
    { slot: "F01", technique: "FRAME BY FRAME", blurb: "Brand film, ninety seconds, hand drawn", youtubeId: null },
    { slot: "F02", technique: "AI", blurb: "Product launch, directed and AI-animated", youtubeId: null },
  ] as ReelItem[],
  verticals: [
    { slot: "V01", technique: "RIGGED", blurb: "Performance ad, six-second hook", youtubeId: null },
    { slot: "V02", technique: "AI", blurb: "Character spot for a fintech app", youtubeId: null },
    { slot: "V03", technique: "FRAME BY FRAME", blurb: "Title sequence, social cut", youtubeId: null },
    { slot: "V04", technique: "RIGGED", blurb: "Explainer, thirty seconds", youtubeId: null },
    { slot: "V05", technique: "AI", blurb: "Episodic teaser, original IP", youtubeId: null },
    { slot: "V06", technique: "RIGGED", blurb: "Retention test, variant C", youtubeId: null },
  ] as ReelItem[],
};

export const closing = {
  label: "04 / 04 — START",
  headline: "You've seen it. Now describe yours.",
  sub: "Same questions. One business day.",
};

/* ── Form ──────────────────────────────────────────────────────────────────
   These VALUES are the contract with Zapier. Renaming one silently breaks
   lead capture — change them here and in the Zap together, never alone.
   ────────────────────────────────────────────────────────────────────────── */

export const BUDGET_OPTIONS = [
  "$200 – $500",
  "$500 – $5,000",
  "$5,000 – $15,000",
  "$15,000 – $50,000",
  "$50,000 +",
] as const;

export const PURPOSE_OPTIONS = [
  "Personal Project",
  "Business",
  "For Fun",
] as const;

export type Budget = (typeof BUDGET_OPTIONS)[number];
export type Purpose = (typeof PURPOSE_OPTIONS)[number];
