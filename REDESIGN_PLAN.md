# ipanimations.ai — Redesign plan (draft 4, 2026-10-07)

Status: **approved 2026-10-07 and built; Daniel's first review round applied the same day** (character lives in the right-edge lane and wall-kicks back up; vertical phone screen; testimonials are stars + small result + quote; no section titles or kickers below the hero; buttons are "Submit" / "Book with us"; proof numbers 300M+ / 1M+ / 1,000+). Steps 2–5 of §11 are done; the sizzle slot runs a poster crossfade until the real cut lands (step 1); the brand kit's rules were treated as guidance, not law, at Daniel's request.

Draft 2: the stick figure stays and becomes the spine of the page (§4). Visual styling waits for the new branding (§5).
Draft 3: **mobile is the primary layout** (§3). Phone order is form → character + sizzle → character for the rest of the page. Every step in §11 is verified on a phone before it counts as done.
Draft 4: **the brand kit landed** (`Branding/brand-kit`). §5 is now the real visual direction, built from the kit's tokens and ten rules. Three places where the kit and this plan pull against each other are flagged in §5.4 for your call. Build order no longer waits for branding.

---

## 1. Brief (what you told me)

| Decision | Answer |
|---|---|
| Job of the page | Turn a paid-ad click into a callable lead. Daniel closes by phone. |
| Scope | Redesign on the same bones: Next.js, `/api/lead` → Zapier → Notion, R2 video, `content/site.ts` as single source of copy. |
| The character | **Keep the stick figure, make him the show.** On load he walks in and switches on the screen. Scroll down: he jumps into a hole and falls the length of the page, superhero landing at the footer. Scroll up: he jumps from element to element back to the top. Position scrubbed to scroll. Built in code by me, on the existing walker's bones. |
| Visual styling | **The brand kit (v1, Oct 2026) is the authority.** Paper and Charcoal backgrounds, Grape and Sunbeam as the only UI colours, neutral text, Grandstander headlines, Manrope everything else, the ten rules. The earlier "chunky sticker" idea is dropped; the kit's own words are "colourful, precise, grown-up". |
| Structure | **Three sections:** 1) Hero: headline, form, the screen, the character → 2) Testimonials → 3) Our work + about us, together. |
| Mobile | **Primary.** Most ad clicks come from phones. Phone order: 1) form, 2) character with the sizzle, 3) character animation through the rest of the page. Designed phone-first, desktop is the expansion. |
| Copy | Clearer, plainer. Say what we sell. Drop the art-school framing (`01 / 04 — THE OFFER`, "animation that makes people move"). |
| Testimonials | Tighten to 2–3 sentences, pull the numbers out as big stat callouts. |
| Hero video | I cut a muted 20–30s sizzle loop from existing clips; you approve before it ships. The character turns it on. |
| Work grid | Curated 6–8 pieces, click to play. The cards double as his platforms on the way up. |
| Form | Hero only. Sticky "Get a quote" in the header scrolls back to it. Fields and dropdown values stay exactly as they are (Zapier contract). |
| About | Short studio blurb. The name is now **IP animations**, "the creative animation studio of IP Ventures" (kit wording). |
| Logo | From the kit: `logos/ip-animations-colour-on-paper.svg` in the header on desktop, mono below 120px, icon-only below 80px, favicon from `icons/favicon.svg`. Animated logo plays one Wave pass on load, as the kit prescribes. |
| Ad promise | Scripts not written yet. Page leads; scripts follow. Hero covers both offers (one-off videos and social series). |

Gone: the drifting shapes, the scroll-reactive colour stage, the film-strip reel, the second form, the numbered labels.

---

## 2. Page structure

```
HEADER   logo · "Our work" · [Get a quote]  (sticky; button scrolls to #quote)

1  HERO                 ~1.2 viewports tall on desktop
   row 1 left : headline, one-line sub, the offer in 3 bullets
   row 1 right: the form (unchanged fields), id="quote"
   row 2      : the SCREEN (sizzle loop in a chunky frame), the CHARACTER beside it,
                the HOLE in the ground line to his other side. The ground line is the
                bottom edge of the hero.
   mobile: short headline → FORM → screen + character + hole  (see §3)

   TICKER   slow marquee strip: "150k+ followers · 100M+ views · frame by frame ·
            rigged · AI · explainers · trailers · social series"

2  TESTIMONIALS         three cards: big stat + short quote + who + "see the work"
                        (each card top = a platform)

3  OUR WORK + ABOUT     about blurb + 3 proof numbers, then the 8-piece grid
                        (each card top = a platform), closing line, [Get a quote]

FOOTER   the LANDING ZONE: ground line, wordmark, email. He lands here.
```

---

## 3. Mobile first

Most people arrive from an ad on a phone, so the phone layout is the design and the desktop layout is what it grows into at wider widths. Priority on a phone, in your words: **form, then character with the sizzle, then the character for the rest of the page.**

### 3.1 Phone hero, top to bottom
1. **Sticky header**, compact: logo + "Get a quote".
2. **Headline + one-line sub.** Two lines max on a 390px screen. The three offer bullets move below the form on phones.
3. **The form.** Starts within the first screen. Native selects, 16px inputs (no iOS zoom), `autocomplete` for name/email/tel, `inputmode="tel"` on phone, `enterkeyhint`, inline errors, clear success state in place. Submit button full width. Nothing above it that competes.
4. **Offer bullets**, one line each.
5. **The screen + the character + the hole.** Screen full width, character standing on its ground line, hole beside him. The intro beat (walk in, flip the switch) plays **when this row scrolls into view**, not on page load, so it is not wasted off-screen. Sizzle is `preload="none"` until the row is within one viewport; the switch calls `play()` (allowed on iOS because it is muted + inline). If autoplay is blocked (Low Power Mode, data saver), the screen shows the poster with a tap-to-play and he shrugs.
6. Ticker, then testimonials, work + about, footer landing zone.

A **sticky bottom bar** with "Get a quote" appears once the form is scrolled out of view and scrolls back to it. Hidden while the form is on screen and while the keyboard is up.

### 3.2 The character on a phone
- **Scale**: ~44px tall (desktop ~90px). Line weight scaled so he stays crisp.
- **Scroll mapping starts at the character row**, not at scroll 0. Scrolling from the form down to him does nothing; once his row leaves the top of the viewport he jumps in and the fall begins.
- **Fall lane**: the right edge. In the testimonial and work sections cards keep a 56px right inset so there is a real lane; in short text blocks he is allowed to overlap the ragged line ends, with a thin paper halo stroke so he always reads. Never over the form.
- **Climb**: platforms are the same cards, stacked, so jumps are short and frequent. Long gaps get invisible mid-platforms, same as desktop.
- **No cursor** on touch. Head follows scroll direction instead. Tap him and he waves; tap the hole and he peers in.
- **Perf**: pure `transform`/`opacity`, under ~40 SVG nodes, no SVG filters on phones (speed lines are strokes, not blur). Budget < 2 ms per frame on a mid-range Android; measured with CPU throttling, not assumed. If a device blows the budget the director degrades to fall + landing only, then to static.
- **Reduced motion**: static at top and bottom, no fall, no jumps, no screen nudge.

### 3.3 Everything else on a phone
- **Work grid**: 16:9 pieces full width, 9:16 pieces two-up. Tap to play inline with native controls. Posters are the LCP risk in that section, so they are properly sized and lazy.
- **Sizzle**: a 720p file for desktop and a ~480p file for phones (≤ 1.5 MB), picked in JS by viewport width and `saveData`. Both from R2.
- **Testimonials**: stat first, quote second, one card per screen width. Horizontal swipe is an option if vertical length becomes a problem; default is stacked.
- **Targets**: Lighthouse mobile Performance ≥ 90, LCP is the headline, no layout shift from the video or the character layer (both reserve their box), 44px minimum tap targets, no horizontal scroll at 360px.

### 3.4 How it gets verified
- Every build step in §11 is checked in the **iOS Simulator** locally (iPhone SE and a current iPhone) and in Chrome's Android emulation before it is called done.
- Every step also goes to a **Vercel preview URL** so you can open it on your actual phone and react. Real thumbs, real Safari, real cellular.
- The Zapier lead flow is tested from a phone, not just a laptop.

---

## 4. The character

### 4.1 Who he is
Same ink stick figure as today, but with a rig that can act: head, neck, torso, two-segment arms and legs, hands and feet as dots. Squash and stretch on impact, anticipation before jumps, follow-through on landings. A tiny bit of personality: he looks where he is going, his head tracks the cursor when idle, he brushes himself off after the landing. Line weight scales with the character so he stays crisp at any size. Style stays ink-on-paper until the branding tells us otherwise.

### 4.2 The storyboard

**Beat 0 · Page load (plays once, not scroll-driven, ~2.5 s)**
Walks in from the left edge along the hero ground line. Stops beside the dark screen. Reaches out and flips a big switch on the frame (or taps it). Screen blinks on, sizzle starts. He steps back, settles into idle: weight shifting, occasional glance at the hole, head follows the cursor.
If the visitor scrolls before the intro finishes, the intro cuts to the end state instantly. Nobody waits for a cartoon to finish before they can read.

**Beat 1 · Jump in (scroll 0 → ~5%)**
First scroll: he turns, crouches (anticipation), springs into the hole. The hole swallows him. This is scrubbed too, so a tiny scroll shows a crouch and scrolling back stands him up again.

**Beat 2 · The fall (scroll ~5% → ~92%)**
He is now a fixed element roughly 40% down the viewport, falling pose, and the page streams up past him. Scroll speed drives everything: slow scroll is a relaxed drop with arms out; fast scroll is a flail, hair/scarf line trailing, speed lines appear, faint motion blur on the limbs. Stop scrolling and he hangs with a slow, floating sway so he never looks frozen.
He falls down a **lane**: the left gutter on wide screens. On narrower desktops where there is no gutter, he falls behind the cards (z-index between page background and content) and peeks out between them, which is its own gag. Never over body text.
Along the way he reacts to what he passes: a glance at a testimonial stat as it goes by, a wave at the Babysnek card. Cheap to do, reads as alive.

**Beat 3 · The landing (scroll ~92% → 100%)**
As the footer ground line enters the viewport he rotates feet-down, arms back, and hits the ground in the superhero pose: one knee, one fist down, head bowed. Impact burst: dust puffs, a crack in the ground line, a 1-frame screen nudge (2px, respects reduced motion). Then he stands, brushes off his shoulders, and idles next to the footer's "Get a quote", occasionally pointing at it.

**Beat 4 · The climb (any scroll up)**
On reverse he leaves the fall lane and jumps platform to platform: footer ground → bottom row of work cards → top row → about block → testimonial cards → ticker → hero ground line → walks back to his spot by the screen. Each jump is an arc scrubbed to the scroll distance between the two platforms: crouch at 0%, apex at 50%, land with a small squash at 100%. Long gaps (e.g. ticker to hero) get an invisible mid-platform so no single arc is taller than a viewport.
He lands on the **tops of cards**, so cards have to be real boxes with edges. That is a layout constraint for §5.

**Direction switch mid-air**
Position is a function of scroll *and* direction. When direction flips, he tweens from where he is to where the other path says he should be over ~250 ms with a pose blend, so there is never a pop. Flipping direction rapidly just makes him jitter a little, which looks like panic, which is fine.

### 4.3 How it works (for the engineer, which is me)
- One fixed, full-viewport SVG layer, `pointer-events: none`, above content by default; drops behind content in the no-gutter fall case.
- **Platforms** are any element with `data-platform`. On mount and on resize a `ResizeObserver` + one `getBoundingClientRect` pass builds the climb path in document coordinates. Never measured inside the scroll handler.
- **Scroll director**: a single `requestAnimationFrame` loop reads `scrollY`, derives progress, velocity and direction, picks the state (`INTRO`, `IDLE_TOP`, `JUMP_IN`, `FALL`, `LAND`, `IDLE_BOTTOM`, `CLIMB`), and writes joint angles. Only `transform` and `opacity` change per frame. No layout, no React re-render per frame; React owns mounting only.
- **Poses** are named sets of joint angles. Motion = interpolating between poses with easing curves per joint. Fall intensity and speed lines scale with velocity, clamped.
- **Reduced motion**: he still exists, but stands still at the top and at the bottom; no fall, no jumps, no screen nudge. The hole is just a hole.
- **Mobile**: see §3.2. Smaller, right-edge lane, same cards as platforms, degrades gracefully under budget pressure.
- **Perf budget**: < 2 ms per frame on a mid phone; no dropped frames at 60 Hz on a laptop. Measured, not assumed.
- Lives in `components/character/`: `Character.tsx` (SVG rig), `poses.ts`, `director.ts` (state machine), `useScrollDirector.ts`.

### 4.4 Extras (strike any you don't want)
- Head tracks the cursor when idle.
- After a successful form submit he celebrates (jump, fist pump) wherever he is on the page.
- He waves at the Babysnek card and glances at the stats on the way down.
- Hovering the hole makes him lean over and look into it.

---

## 5. Visual direction: the brand kit

Source: `Branding/brand-kit/` (guidelines HTML, `colours.css`, `colours.json`, logos, icons, animated logo). Everything below is the kit applied to this page; nothing here is invented.

### 5.1 Tokens (verbatim from `colours.css`)
| Role | Token | Hex | Use on this page |
|---|---|---|---|
| Light background | Paper | `#FFF6EA` | hero, testimonials |
| Dark background | Charcoal | `#2B2A31` | work + about, footer |
| Primary | Grape | `#7B57F5` | **one per screen**: the submit button in the hero; the headline dot elsewhere |
| Secondary | Sunbeam | `#FFC629` | one or two per screen: a highlighted word, the landing burst |
| Text on Paper | Ink / Ink soft | `#1E1D22` / `#4A4460` | body, labels |
| Text on Charcoal | Paper / Paper soft | `#FFF6EA` / `#CFC8BC` | body, labels |
| Lines | Line light / Line dark | `#E6DCCB` / `#3A3940` | card edges, ground lines, form borders |
| Logo only | Bubblegum, Mint, Sky, Tangerine, Grape light | — | **never in UI** |

Type: **Grandstander 800** for headlines (never more than two lines, never body), **Manrope** 400 body / 600 UI and labels (uppercase, `.16em` tracking) / 700 buttons. Both are on Google Fonts, loaded with `next/font` like today. Web scale from the kit: label 11, body 15/1.6, H3 20, H2 28, H1 36. "Small type, big space": headlines are smaller than today's, and at least 60% of any screen is background.

Shape: buttons 6–8px radius, cards 14px, no pills, no shadows, no gradients. Highlights are flat Sunbeam behind Ink text, 3px radius. The dot ends headlines: `0.2em` round, Grape on Paper, Sunbeam on Charcoal, replacing the full stop.

Layout: **three rows** (top bar · content · footer), content centred or anchored to one edge, never spread to four corners.

### 5.2 The page in brand
- **Header**: Paper, colour logo at ≥120px wide; on phones the mono Ink logo, or the bare mark under 80px. One Wave pass of the animated logo on load, then static. "Get a quote" is the screen's one Grape thing.
- **Hero** (Paper): headline in Grandstander ending in a Grape dot, one Sunbeam-highlighted word, Manrope sub and bullets, the form as a Line-light bordered card with a Grape submit. Since the submit is the Grape thing, the headline dot in the hero is Ink, not Grape.
- **Screen + character + hole**: the screen frame is Charcoal with a 14px radius; the hole is Charcoal; the character is Ink.
- **Ticker**: Line-light rule above and below, Manrope 600 labels, no colour.
- **Testimonials** (Paper): three 14px cards, Line-light edge. Stat in Grandstander with a Grape dot. Quote in Manrope.
- **Work + about** (Charcoal): Paper text, Line-dark card edges, the films carry the colour. Headline dot is Sunbeam here. One Grape thing: the "Get a quote" link at the end of the section.
- **Footer** (Charcoal): mono Paper logo, email, "a studio of IP Ventures". The ground line he lands on is Line dark.
- Interface motion is 200ms ease-out fades, per rule 10. Hover previews on cards are a fade, not a zoom.

### 5.3 The character in brand
He is drawn in **Ink on Paper and Paper on Charcoal**, exactly like the mono logo. When he falls out of the Paper sections into the Charcoal ones he switches colour at the boundary, which reads as falling into the dark, which is what the hole promised.
His head is a round Ink ball, the same ball that bounces along the letters in the animated logo. That makes him the brand's existing motion device with a body, not a second mascot. The superhero landing impact is the page's Sunbeam moment on that screen (a flat burst, no gradient). The hole is Charcoal. Nothing on him is Grape.

### 5.4 Where the kit and the plan disagree (your call)
1. **Rule 10, "motion is for the logo and the work; squash-and-stretch belongs to the logo and the films."** A scroll-driven character with squash and stretch is interface motion by the letter of the rule. My argument for keeping him: on a studio's own lead page the character *is* the work on display, and he is built from the kit's own motion device (the Ink ball). Recommended: keep him, keep all other interface motion to 200ms fades so he is the single exception. Alternative: cut the squash and stretch and have him move rigidly, which I think is worse than not having him.
2. **"Bold and playful" vs "colourful, precise, grown-up."** The kit wins. The energy comes from the character and the films, not from chunky UI. If you still want louder, the lever is more Charcoal and bigger video, not more colour.
3. **Domain and name.** The kit's end card says `IPANIMATIONS.STUDIO`; this site is `ipanimations.ai` and the current content file says "IP VENTURES animations". I will use `ipanimations.ai` and "IP animations" everywhere unless you say otherwise.

Small kit constraints worth knowing: the colour logo may never sit on Grape, Sunbeam, photos or busy backgrounds; below 120px it goes mono; Sunbeam is never text; Grape text only at 15px+ on Paper.

---

## 6. Copy (draft; everything here is yours to rewrite)

### Hero
**Headline options** (pick one or mash). Grandstander, two lines max, ends in the dot, one Sunbeam-highlighted word marked with ==:
1. "Animated videos people actually ==finish==."
2. "Animation that gets ==watched==, shared, and acted on."
3. "We make the animated video. You get the ==audience==."
(The kit's own hero example is "Motion that makes ideas land." It is good, and it is option 4.)

**Sub:** "Explainers, trailers, intros, and ongoing social series with a character people come back for. Hand-drawn, rigged, or AI. Same team, same standard."

**Offer bullets:**
- **One-off videos.** Explainers, trailers, intros. Brief → storyboard → delivered film.
- **Social series.** A character, a schedule, and clips built to grow a following.
- **Any technique.** Frame by frame, rigged, or AI-assisted. We pick what fits the job and the budget.

**Form lead-in:** "Tell us what you need. You'll hear back within one business day."
**Button:** "Get a quote"
**Trust strip:** "150k+ followers built · 100M+ views · Wooshi World · Ethermail · Babysnek"

### Testimonials (tightened; `…` marks removed words)

**Wooshi World** · stat: **0 → 150k+ followers in 6 months**
> "We had the vision for the series but literally zero social presence… IP Ventures took our character, Woo, and basically gave him a life on Instagram. We went from 0 to 150k+ followers in like 6 months… The quality made us look legit from day one."
> — Wooshi World Team · see the work: Wooshi Intro Video

**Ethermail** · stat line: **Web3 onboarding, explained in one video** (no number in the quote; I won't invent one)
> "Explaining Web3 benefits to people who barely know what a wallet is… it's a nightmare. [IP Ventures] took the 'hard to understand' parts and made them click for our users… people finally just 'got it' without us having to write a novel."
> — Ethermail C-suite

**Babysnek** · stat: **100M+ views across socials**
> "I basically started with version #1 and IP Ventures built out the rest… redesigning the character, figuring out the personality, and writing the scripts that actually work for YouTube… I've hit over 100M views across my socials now. If you want to actually go viral and not just make a pretty video, this is the team you hire."
> — Jessie, CEO of Babysnek · see the work: No Bromance

### About (section 3)
**Heading:** "IP animations." (with the dot)
**Kicker label:** "THE CREATIVE ANIMATION STUDIO OF IP VENTURES"
**Blurb:** "We're the creative animation studio of IP Ventures. Animators first: we were storyboarding and drawing long before the models could. Today we work frame by frame, rigged, or AI-assisted, and we pick the technique per job, not per trend. Everything is designed, directed and finished by people. Tell us what you need and the person who answers is the one who will make it."
**Three proof numbers** (need your real figures): years animating · films/clips shipped · combined views.
**Closing line under the grid:** "The AI work isn't a prompt and a prayer. It's storyboarded, designed and directed like everything else here."

---

## 7. Hero sizzle loop
- 24–30 s, seamless loop, **no audio**, `autoplay muted loop playsinline`, poster for first paint. Starts dark; the character's switch starts playback.
- 16:9 at 1280×720, H.264 MP4 ≤ 4 MB + WebM. Served from R2 via the existing upload script.
- Sources (on R2): Degen Future Trailer, 3D Showreel, Kabu Sunset Intro, Wooshi Intro, Barry the Player, Bonk, Needs Salt, Laugh Too Hard. 1–2 s shots; verticals shown 2–3 side by side, never ugly-cropped.
- Rendered to `Videos of our work /sizzle-v1.mp4` for your approval before R2.

---

## 8. Work grid: the eight

| # | Piece | Why |
|---|---|---|
| 1 | Wooshi Intro Video (16:9) | Testimonial 1 links to it |
| 2 | No Bromance · Babysnek (9:16) | Testimonial 3 links to it; tagged explainer |
| 3 | Degen Future Trailer (16:9) | strongest trailer |
| 4 | 3D Showreel (16:9) | range beyond 2D |
| 5 | Kabu Sunset Intro (16:9) | strongest intro |
| 6 | Barry the Player (9:16) | AI, newest |
| 7 | Bonk (9:16) | AI, different style |
| 8 | Needs Salt · Babysnek (9:16) | second social-series example |

Hidden (kept in `site.ts`): Laugh Too Hard, Personal Time, Paycheck, Barry and his Girl. Confirm Barry and Bonk are AI and I'll label them.

---

## 9. What changes in the code

| Area | Change |
|---|---|
| `components/Stage.tsx` | **Deleted** (scene colours, drifting shapes). |
| `components/WalkCycle.tsx` | **Replaced** by `components/character/*` (rig, poses, director, hook). Its walk cycle is the seed for the new rig. |
| `components/Sections.tsx` | Rewritten: `Hero` (with `Screen`, `Hole`), `Ticker`, `Testimonials`, `WorkAndAbout`. Cards carry `data-platform`. |
| `components/ReelCard.tsx` | Kept, restyled, hover-preview added; YouTube fallback untouched. |
| `components/LeadForm.tsx` | Fields, values, validation, payload **untouched**. Restyled only. Single instance, `id="quote"`. Emits a `lead:sent` event the character listens for. |
| `components/Chrome.tsx` | Sticky header + "Get a quote"; footer becomes the landing zone with a ground line. |
| `content/site.ts` | New copy, testimonial `stat`, `featured` flag, hero `sizzle` src/poster. `BUDGET_OPTIONS`/`PURPOSE_OPTIONS` **untouched**. |
| `app/globals.css` | Neutral token block (brand swaps here later), new components, old stage CSS removed. |
| `app/layout.tsx` | Title/description to the new headline. Fonts: Grandstander + Manrope via `next/font/google`, Archivo and Plex Mono removed. Favicon from the kit. |
| `public/brand/` | Kit logos, marks and favicon copied in; placeholder mark deleted. `brand.logoIsPlaceholder` goes away. |
| `components/AnimatedLogo.tsx` | New: the kit's Wave variant, one pass on load, then static. Ported from `IP Animations Logo Animated.dc.html`. |
| `app/api/lead/route.ts`, `scripts/upload-to-r2.mjs` | **Untouched.** |

Housekeeping (your call): `MM38_V3_review.mp4` and the `Videos of our work ` folder are untracked in the repo root. Move them out or gitignore them so they never get committed.

---

## 10. Things I need from you (none blocking)
1. Headline pick (or your own).
2. Your call on the three §5.4 conflicts (character motion vs rule 10, tone, name/domain).
3. Three proof numbers for the about block, or say "drop the numbers".
4. Ethermail explainer video, if it exists.
5. Confirm Barry the Player and Bonk are AI pieces.
6. Strike any §4.4 extras you don't want.

Placeholders go in as `TODO(daniel)` in `site.ts` and get swapped when you send them.

---

## 11. Build order

1. **Sizzle cut** (ffmpeg, local), in two sizes (720p desktop, ~480p phone). You approve the video first; the hero depends on it.
2. **Brand foundation + structure + copy, phone-first.** Kit tokens into `globals.css`, Grandstander/Manrope, logos and favicon in, animated logo on load. Built at 390px first, then widened. Three sections on the three-row grid, sticky header + sticky bottom CTA, Paper → Charcoal split, footer landing zone, cards as 14px boxes with `data-platform`. Site works end to end; a test lead reaches `/api/lead` with the identical payload, sent from a phone.
3. **Character engine, part 1: fall + landing.** Rig (Ink ball head), director, fall lane, colour switch at the Charcoal boundary, superhero landing with the Sunbeam burst. Built and profiled on the phone layout first; reduced-motion and degrade paths from day one.
4. **Character engine, part 2: intro + climb.** Walk-in, switch, screen on; platform jumps on the way up; direction-switch blending.
5. **Character polish.** Reactions, extras from §4.4, perf pass on a real phone.
6. **Design pass against the ten rules.** Walk every screen: one Grape thing, one or two Sunbeam, 60% background, two-line headlines, dots. Hover previews, ticker. Final Lighthouse mobile pass against the §3.3 targets.
7. **Upload sizzle to R2, Vercel preview, you review on your phone, promote.**

Each step is its own commit and each step ships to a Vercel preview you can open on your phone. Steps 3–5 are demoable on their own so you can react to the character early, before it is "finished".
