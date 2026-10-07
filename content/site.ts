/**
 * Single source of truth for every piece of copy, link and option on the page.
 * Change things here, not in the components.
 *
 * Anything marked TODO(daniel) is a placeholder waiting on a real value.
 */

export const brand = {
  name: "IP animations",
  tagline: "The creative animation studio of IP Ventures",
  domain: "ipanimations.ai",
  email: "hello@ipanimations.ai",
  /** The call to action everywhere except the form's own submit button. */
  book: "Book with us",
  /** From Branding/brand-kit. */
  logo: {
    colour: "/brand/ip-animations-colour-on-paper.svg",
    monoInk: "/brand/ip-animations-mono-ink.svg",
    monoPaper: "/brand/ip-animations-mono-paper.svg",
    markInk: "/brand/mark-ink.svg",
    markPaper: "/brand/mark-paper.svg",
  },
};

/* ── 01 · Hero ──────────────────────────────────────────────────────────── */

export const hero = {
  /** Words wrapped in == == get the Sunbeam highlight. The dot is added by the component. */
  headline: "Animations people ==want==",
  sub: "Made by animators. Built to get watched.",
  offer: [
    { title: "One-off videos", body: "like explainers, trailers, intros." },
    { title: "Social series:", body: "clips built to grow a following." },
    { title: "Cutting edge technique:", body: "frame by frame, rigged, or AI-built." },
  ],
  trust: ["1M+ followers built", "300M+ views", "Wooshi World", "Ethermail", "Babysnek"],
  formLead: "Tell us what you need. You'll hear back within one business day.",
  cta: "Submit",
  /**
   * The sizzle loop, played on a vertical phone screen (9:16) that sits beside
   * the testimonials and switches itself on when it scrolls into view.
   * `src`/`poster` are R2 keys. Until the real cut lands the screen plays a crossfade of the
   * vertical reel posters instead (see Screen.tsx).
   * v2 cut 2026-10-07: 17 shots, 23.9s, 720×1280. Rank-1 pieces (Degen, No
   * Bromance) appear most, rank-2 twice, rank-3 once; 16:9 films are stacked
   * three high to fill the phone. Shot list and recipe in
   * scripts/sizzle.edl.txt; re-cut and upload under a new key.
   */
  sizzle: {
    src: "reel/sizzle-vertical-v2.mp4" as string | undefined,
    poster: "reel/sizzle-vertical-v2.jpg",
  },
};

export const ticker = [
  "1M+ followers built",
  "300M+ views",
  "1,000+ animations",
  "Frame by frame",
  "Rigged",
  "AI-assisted",
  "Explainers",
  "Trailers",
  "Social series",
  "Intros",
  "Characters",
];

/* ── 02 · Testimonials ─────────────────────────────────────────────────────
   Real client quotes, supplied 2026-09-21, tightened 2026-10-07. Ellipses mark
   removed words; nothing has been added. `work` points at a reel item slug.
   ──────────────────────────────────────────────────────────────────────── */

export type Testimonial = {
  /** One short bold line: the result. Sits small, above the quote. */
  result: string;
  quote: string;
  attribution: string;
  work?: string;
};

export const testimonials = {
  items: [
    {
      result: "0 → 150k+ followers in six months",
      quote:
        "We had the vision for the series but literally zero social presence… IP Ventures took our character, Woo, and basically gave him a life on Instagram. We went from 0 to 150k+ followers in like 6 months… The quality made us look legit from day one.",
      attribution: "Wooshi World team",
      work: "wooshi-intro-video",
    },
    {
      result: "Web3 onboarding, explained in one video",
      quote:
        "Explaining Web3 benefits to people who barely know what a wallet is… it's a nightmare. [IP Ventures] took the 'hard to understand' parts and made them click for our users… people finally just 'got it' without us having to write a novel.",
      attribution: "Ethermail C-suite",
    },
    {
      result: "100M+ views across socials",
      quote:
        "I basically started with version #1 and IP Ventures built out the rest… redesigning the character, figuring out the personality, and writing the scripts that actually work for YouTube… I've hit over 100M views across my socials now. If you want to actually go viral and not just make a pretty video, this is the team you hire.",
      attribution: "Jessie, CEO of Babysnek",
      work: "no-bromance-babysnek",
    },
  ] as Testimonial[],
};

/* ── 03 · Work + about ─────────────────────────────────────────────────── */

export const about = {
  body: "We're the creative animation studio of IP Ventures. Animators first: we were storyboarding and drawing long before the models could. Today we work frame by frame, rigged, or AI-assisted, and we pick the technique per job, not per trend. Everything is designed, directed and finished by people. Tell us what you need and the person who answers is the one who will make it.",
  // Daniel, 2026-10-07: "probably 300M+ and/or 500M+ views, 1M+ followers, 1,000+ animations".
  // 300M+ is the conservative figure; bump to 500M+ if you'd rather.
  proof: [
    { n: "300M+", l: "views" },
    { n: "1M+", l: "followers built" },
    { n: "1,000+", l: "animations made" },
  ],
  closer:
    "The AI work isn't a prompt and a prayer. It's storyboarded, designed and directed like everything else here.",
};

export type Technique = "HANDMADE" | "AI";

export type ReelItem = {
  slug: string;
  title: string;
  youtubeId?: string;
  /** R2 object key, e.g. "reel/degen-future-trailer.mp4". */
  src?: string;
  /** R2 key of a poster still. */
  poster?: string;
  technique?: Technique;
  tag?: string;
  /** Shown in the grid. Everything else stays here for the sizzle and future use. */
  featured?: boolean;
};

export const reel = {
  /** 16:9 — the films. */
  features: [
    { slug: "wooshi-intro-video", title: "Wooshi Intro Video", youtubeId: "Fltd--DgKHE", src: "reel/wooshi-intro-video.mp4", poster: "reel/wooshi-intro-video.jpg", technique: "HANDMADE", featured: true },
    { slug: "degen-future-trailer", title: "Degen Future Trailer", youtubeId: "wShBHfbeQ-U", src: "reel/degen-future-trailer.mp4", poster: "reel/degen-future-trailer.jpg", technique: "HANDMADE", featured: true },
    { slug: "3d-showreel", title: "3D Showreel", youtubeId: "IFyjA-mFyO4", src: "reel/3d-showreel.mp4", poster: "reel/3d-showreel.jpg", technique: "HANDMADE", featured: true },
    { slug: "kabu-sunset-intro", title: "Kabu Sunset Intro", youtubeId: "jtMZKfgTUaA", src: "reel/kabu-sunset-intro.mp4", poster: "reel/kabu-sunset-intro.jpg", technique: "HANDMADE", featured: true },
  ] as ReelItem[],

  /** 9:16 — the social cuts. */
  verticals: [
    { slug: "no-bromance-babysnek", title: "No Bromance | BabySnek", youtubeId: "LmW5kqDgOFY", src: "reel/no-bromance-babysnek.mp4", poster: "reel/no-bromance-babysnek.jpg", technique: "HANDMADE", tag: "Explainer", featured: true },
    // TODO(daniel): confirm Barry and Bonk are AI pieces; then set technique: "AI".
    { slug: "barry-the-player", title: "Barry the Player", src: "reel/barry-the-player.mp4", poster: "reel/barry-the-player.jpg", featured: true },
    { slug: "bonk", title: "Bonk", src: "reel/bonk.mp4", poster: "reel/bonk.jpg", featured: true },
    { slug: "needs-salt-babysnek", title: "Needs Salt | Babysnek", youtubeId: "bU6YVWnRBiI", src: "reel/needs-salt-babysnek.mp4", poster: "reel/needs-salt-babysnek.jpg", technique: "HANDMADE", featured: true },
    { slug: "laugh-too-hard-snek", title: "Laugh too Hard | Snek", youtubeId: "4kDYwB4-SOY", src: "reel/laugh-too-hard-snek.mp4", poster: "reel/laugh-too-hard-snek.jpg", technique: "HANDMADE" },
    { slug: "personal-time-ket", title: "Personal Time | Ket", youtubeId: "xiD_zdiwZgA", src: "reel/personal-time-ket.mp4", poster: "reel/personal-time-ket.jpg", technique: "HANDMADE" },
    { slug: "paycheck-babysnek", title: "Paycheck | Babysnek", youtubeId: "0GhHDqk6ZwY", src: "reel/paycheck-babysnek.mp4", poster: "reel/paycheck-babysnek.jpg", technique: "HANDMADE" },
    { slug: "barry-and-his-girl", title: "Barry and his Girl", src: "reel/barry-and-his-girl.mp4", poster: "reel/barry-and-his-girl.jpg" },
  ] as ReelItem[],
};

/* ── Form options ──────────────────────────────────────────────────────────
   These exact strings are the contract with the Zap. Do not edit.
   ──────────────────────────────────────────────────────────────────────── */

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
