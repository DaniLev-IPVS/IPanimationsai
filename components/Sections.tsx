import { brand, testimonials, reel, about, clients, aboutUs } from "@/content/site";
import ReelCard from "./ReelCard";
import HeroStage from "./HeroStage";
import HomeHero from "./HomeHero";

/* ── 01 · HERO ───────────────────────────────────────────────────────────── */

/** `mode="form"` on /book; `mode="cta"` on the homepage (a button to /book). */
export function Hero({ mode = "form" }: { mode?: "form" | "cta" }) {
  return mode === "cta" ? <HomeHero /> : <HeroStage />;
}

/* ── CLIENT LOGOS: the running banner in the hero's band ─────────────────── */

export function LogoStrip() {
  // Twice over, so the strip loops without a seam.
  const items = [...clients.items, ...clients.items];
  return (
    <div className="bandlogos">
      <p className="label bandlogos__label" id="clients-label">
        {clients.label}
      </p>
      <ul className="sr-only" aria-labelledby="clients-label">
        {clients.items.map((c) => (
          <li key={c.name}>{c.name}</li>
        ))}
      </ul>
      <div className="clients__strip" aria-hidden="true">
        <div className="clients__track">
          {items.map((c, i) => (
            <span key={i} className={`clients__item clients__item--${c.shape} clients__item--${c.tone}`} title={c.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.logo} alt="" decoding="async" />
              {c.shape === "icon" && <span className="clients__name">{c.name}</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 02 · TESTIMONIALS ───────────────────────────────────────────────────── */

export function Testimonials() {
  return (
    <section id="testimonials" className="section section--paper section--quotes">
      <div className="wrap">
        <div className="quotes">
          {testimonials.items.map((t, i) => (
            <figure className="quote" key={i} data-platform>
              <div className="stars" aria-label="Five stars">
                {Array.from({ length: 5 }).map((_, k) => (
                  <svg key={k} viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                    <path d="M10 1.6l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L10 15l-5.3 2.8 1.1-5.9L1.5 7.8l5.9-.8z" fill="currentColor" />
                  </svg>
                ))}
              </div>
              <p className="quote__result">{t.result}</p>
              <blockquote className="quote__body">
                <p>&ldquo;{t.quote}&rdquo;</p>
              </blockquote>
              <figcaption className="quote__by">
                <span className="label">{t.attribution}</span>
                {t.work && (
                  <a className="quote__work" href={`#${t.work}`}>
                    See the work ↓
                  </a>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 03 · WORK + ABOUT ───────────────────────────────────────────────────── */

export function WorkAndAbout({ bookHref = "#quote", bookLabel = brand.book }: { bookHref?: string; bookLabel?: string }) {
  const films = reel.features.filter((i) => i.featured);
  const shorts = reel.verticals.filter((i) => i.featured);
  return (
    <section id="work" className="section section--charcoal">
      <div className="wrap">
        <div className="about" id="about" data-platform>
          <div className="about__copy">
            <p className="body about__body">{about.body}</p>
          </div>
          <ul className="proof">
            {about.proof.map((p) => (
              <li key={p.l}>
                <span className="proof__n">{p.n}</span>
                <span className="label proof__l">{p.l}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid--films">
          {films.map((item) => (
            <ReelCard key={item.slug} item={item} orientation="h" />
          ))}
        </div>
        <div className="grid grid--shorts">
          {shorts.map((item) => (
            <ReelCard key={item.slug} item={item} orientation="v" />
          ))}
        </div>

        <div className="work__end">
          <p className="body work__closer">{about.closer}</p>
          <a href={bookHref} className="btn btn--lg">
            {bookLabel}
          </a>
        </div>
      </div>
    </section>
  );
}

/* ── 04 · ABOUT US (homepage only) ───────────────────────────────────────── */

export function AboutUs() {
  return (
    <section id="about-us" className="section section--paper aboutus" aria-labelledby="about-us-title">
      <div className="wrap aboutus__wrap">
        <figure className="aboutus__art">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={aboutUs.image.src}
            alt={aboutUs.image.alt}
            width={aboutUs.image.width}
            height={aboutUs.image.height}
            loading="lazy"
            decoding="async"
          />
        </figure>
        <div className="aboutus__copy">
          <p className="label aboutus__label">{aboutUs.label}</p>
          <h2 id="about-us-title" className="h2 aboutus__title">
            {aboutUs.title}
            <span className="dot" aria-hidden="true" />
          </h2>
          {aboutUs.body.map((p) => (
            <p key={p.slice(0, 24)} className="body aboutus__body">
              {p}
            </p>
          ))}
          <a href="#top" className="btn btn--lg aboutus__cta">
            {aboutUs.button}
            <span aria-hidden="true">↑</span>
          </a>
        </div>
      </div>
    </section>
  );
}
