import { brand, hero, ticker, testimonials, reel, about } from "@/content/site";
import ReelCard from "./ReelCard";
import HeroStage from "./HeroStage";

/* ── 01 · HERO ───────────────────────────────────────────────────────────── */

export function Hero() {
  return <HeroStage />;
}

/* ── TICKER ──────────────────────────────────────────────────────────────── */

export function Ticker() {
  const items = [...ticker, ...ticker];
  return (
    <div className="ticker" aria-hidden="true" data-platform>
      <div className="ticker__track">
        {items.map((t, i) => (
          <span key={i} className="ticker__item">
            {t}
            <span className="ticker__dot" />
          </span>
        ))}
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

export function WorkAndAbout() {
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
          <a href="#quote" className="btn btn--lg">
            {brand.book}
          </a>
        </div>
      </div>
    </section>
  );
}
