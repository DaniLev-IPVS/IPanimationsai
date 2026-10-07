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

/* ── 02 · Testimonials ─────────────────────────────────────────────────────
   Real client quotes, supplied 2026-09-21. `work` points at a reel item slug
   so the quote can link to the thing it is about.
   ──────────────────────────────────────────────────────────────────────── */

export type Testimonial = {
  /** One string per paragraph. */
  quote: string[];
  attribution: string;
  /** Slug of a reel item this quote is about, if there is one. */
  work?: string;
};

export const testimonials = {
  label: "02 / 04 — WHAT THEY SAY AFTER",
  lead: "Nobody hires an animation studio twice because the animation was pretty.",
  items: [
    {
      quote: [
        "We had the vision for the series but literally zero social presence. We needed to build a following before the release so we weren't launching into a void. IP Ventures took our character, Woo, and basically gave him a life on Instagram. We went from 0 to 150k+ followers in like 6 months… it was wild. The quality made us look legit from day one, which was huge for our partner conversations later on.",
      ],
      attribution: "Wooshi World Team",
      work: "wooshi-intro-video",
    },
    {
      quote: [
        "Our tech is complicated. Explaining Web3 benefits to people who barely know what a wallet is… it's a nightmare.",
        "We needed a video that made our features feel simple, not technical. [IP Ventures] …took the 'hard to understand' parts and made them click for our users. Honestly, it saved us so much time on onboarding because people finally just 'got it' without us having to write a novel.",
      ],
      attribution: "Ethermail C-suite",
    },
    {
      quote: [
        "I basically started with version #1 and IP Ventures built out the rest. I had them do everything, redesigning the character, figuring out the personality, and writing the scripts that actually work for YouTube. It paid off big time. I've hit over 100M views across my socials now. If you want to actually go viral and not just make a pretty video, this is the team you hire.",
      ],
      attribution: "Jessie, CEO of Babysnek",
      work: "no-bromance-babysnek",
    },
  ] as Testimonial[],
};

/* ── 03 · Reel ─────────────────────────────────────────────────────────────
   Imported from the Webflow "Our Works" export, 2026-09-21. Order follows the
   export's own Order column; the two AI pieces had no order and sit last.

   `technique` uses the export's own two categories. The export does not
   distinguish frame-by-frame from rigged inside "handmade" — say which is
   which and the labels can get finer.
   ──────────────────────────────────────────────────────────────────────── */

export type Technique = "HANDMADE" | "AI";

export type ReelItem = {
  slug: string;
  title: string;
  /** YouTube id, if the piece also lives there. Optional: R2-only pieces have none. */
  youtubeId?: string;
  /**
   * R2 object key of the film, e.g. "reel/degen-future-trailer.mp4". When set
   * (and NEXT_PUBLIC_MEDIA_BASE_URL is configured) the card plays this file
   * from R2; otherwise it falls back to the YouTube embed.
   */
  src?: string;
  /** R2 key of a poster still. Optional — falls back to the YouTube thumbnail. */
  poster?: string;
  /** Left off until we say which it is — the card then shows no technique label. */
  technique?: Technique;
  /** Extra tag from the export's Labels column, if any. */
  tag?: string;
};

export const reel = {
  label: "03 / 04 — THE WORK",
  lead: "Frame by frame. Rigged. AI. Same standard.",
  closer:
    "The AI work isn't a prompt and a prayer. It's storyboarded, designed and directed like everything else here — the model just replaces the in-between. That's why it doesn't look like everyone else's.",

  /** 16:9 — the films. */
  features: [
    { slug: "degen-future-trailer", title: "Degen Future Trailer", youtubeId: "wShBHfbeQ-U", src: "reel/degen-future-trailer.mp4", poster: "reel/degen-future-trailer.jpg", technique: "HANDMADE" },
    { slug: "3d-showreel", title: "3D Showreel", youtubeId: "IFyjA-mFyO4", src: "reel/3d-showreel.mp4", poster: "reel/3d-showreel.jpg", technique: "HANDMADE" },
    { slug: "kabu-sunset-intro", title: "Kabu Sunset Intro", youtubeId: "jtMZKfgTUaA", src: "reel/kabu-sunset-intro.mp4", poster: "reel/kabu-sunset-intro.jpg", technique: "HANDMADE" },
    { slug: "wooshi-intro-video", title: "Wooshi Intro Video", youtubeId: "Fltd--DgKHE", src: "reel/wooshi-intro-video.mp4", poster: "reel/wooshi-intro-video.jpg", technique: "HANDMADE" },
  ] as ReelItem[],

  /** 9:16 — the social cuts. */
  verticals: [
    { slug: "barry-the-player", title: "Barry the Player", src: "reel/barry-the-player.mp4", poster: "reel/barry-the-player.jpg" },
    { slug: "laugh-too-hard-snek", title: "Laugh too Hard | Snek", youtubeId: "4kDYwB4-SOY", src: "reel/laugh-too-hard-snek.mp4", poster: "reel/laugh-too-hard-snek.jpg", technique: "HANDMADE" },
    { slug: "personal-time-ket", title: "Personal Time | Ket", youtubeId: "xiD_zdiwZgA", src: "reel/personal-time-ket.mp4", poster: "reel/personal-time-ket.jpg", technique: "HANDMADE" },
    { slug: "paycheck-babysnek", title: "Paycheck | Babysnek", youtubeId: "0GhHDqk6ZwY", src: "reel/paycheck-babysnek.mp4", poster: "reel/paycheck-babysnek.jpg", technique: "HANDMADE" },
    { slug: "barry-and-his-girl", title: "Barry and his Girl", src: "reel/barry-and-his-girl.mp4", poster: "reel/barry-and-his-girl.jpg" },
    { slug: "no-bromance-babysnek", title: "No Bromance | BabySnek", youtubeId: "LmW5kqDgOFY", src: "reel/no-bromance-babysnek.mp4", poster: "reel/no-bromance-babysnek.jpg", technique: "HANDMADE", tag: "Explainer Video" },
    { slug: "needs-salt-babysnek", title: "Needs Salt | Babysnek", youtubeId: "bU6YVWnRBiI", src: "reel/needs-salt-babysnek.mp4", poster: "reel/needs-salt-babysnek.jpg", technique: "HANDMADE" },
    { slug: "bonk", title: "Bonk", src: "reel/bonk.mp4", poster: "reel/bonk.jpg" },
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
