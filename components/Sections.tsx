import { brand, hero, ticker, testimonials, reel, about } from "@/content/site";
import LeadForm from "./LeadForm";
import ReelCard from "./ReelCard";
import Screen from "./Screen";

/** "==word==" → highlighted word. The closing dot is added by the caller. */
function Highlight({ text }: { text: string }) {
  const parts = text.split(/(==[^=]+==)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("==") ? (
          <mark key={i} className="hl">
            {p.slice(2, -2)}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/* ── 01 · HERO ───────────────────────────────────────────────────────────── */

export function Hero() {
  return (
    <section id="top" className="hero">
      <div className="wrap hero__grid">
        <div className="hero__copy">
          <h1 className="h1">
            <Highlight text={hero.headline} />
            <span className="dot" aria-hidden="true" />
          </h1>
          <p className="body hero__sub">{hero.sub}</p>
        </div>

        <ul className="offer">
          {hero.offer.map((o) => (
            <li key={o.title} className="offer__item">
              <span className="offer__text">
                <strong>{o.title}</strong>
                {o.body}
              </span>
            </li>
          ))}
        </ul>

        <div className="hero__form" id="quote">
          <p className="body hero__formlead">{hero.formLead}</p>
          <LeadForm source="hero" cta={hero.cta} />
          <ul className="trust" aria-label="Clients and results">
            {hero.trust.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>

        <div className="stage" id="stage">
          <Screen />
        </div>
      </div>
      {/* The character's hole sits on the hero's ground line at the right
          edge, positioned by the character engine. */}
      <div className="hole" id="hole" aria-hidden="true">
        <span className="hole__rim" />
      </div>
      <div className="hero__ground" id="stage-ground" aria-hidden="true" />
    </section>
  );
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
