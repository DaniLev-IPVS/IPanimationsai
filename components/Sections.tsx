import { hero, testimonials, reel, closing } from "@/content/site";
import LeadForm from "./LeadForm";
import ReelCard from "./ReelCard";

/* ── 01 · HERO ───────────────────────────────────────────────────────────── */

export function Hero() {
  return (
    <section id="hero" className="section section--tall">
      <div className="wrap hero">
        <div className="hero__copy">
          <p className="label">{hero.label}</p>
          <h1 className="display hero__headline">{hero.headline}</h1>
          <p className="lede hero__sub">{hero.sub}</p>
        </div>
        <div className="hero__form">
          <p className="lede hero__formlead">{hero.formLead}</p>
          <LeadForm source="hero" cta="Start the reel" />
        </div>
      </div>
    </section>
  );
}

/* ── 02 · TESTIMONIALS ───────────────────────────────────────────────────── */

export function Testimonials() {
  return (
    <section id="testimonials" className="section">
      <div className="wrap">
        <p className="label">{testimonials.label}</p>
        <h2 className="display-sm quotes__lead">{testimonials.lead}</h2>

        <div className="quotes">
          {testimonials.items.map((t, i) => (
            <figure className="quote" key={i}>
              <span className="quote__mark" aria-hidden="true">
                &ldquo;
              </span>
              <blockquote className="quote__body">
                {t.quote.map((para, p) => (
                  <p key={p}>{para}</p>
                ))}
              </blockquote>
              <figcaption className="quote__by label">
                {t.attribution}
                {t.work && (
                  <a className="quote__work" href={`#${t.work}`}>
                    see the work ↓
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

/* ── 03 · REEL ───────────────────────────────────────────────────────────── */

export function Reel() {
  return (
    <section id="reel" className="section reel">
      <div className="wrap">
        <p className="label reel__label">{reel.label}</p>
        <h2 className="display-sm reel__lead">{reel.lead}</h2>

        <div className="reel__features">
          {reel.features.map((item) => (
            <div key={item.slug} id={item.slug}>
              <ReelCard item={item} orientation="h" />
            </div>
          ))}
        </div>

        <div className="reel__wall">
          {reel.verticals.map((item) => (
            <div key={item.slug} id={item.slug}>
              <ReelCard item={item} orientation="v" />
            </div>
          ))}
        </div>

        <p className="reel__closer">{reel.closer}</p>
      </div>
    </section>
  );
}

/* ── 04 · CLOSING ────────────────────────────────────────────────────────── */

export function Closing() {
  return (
    <section id="closing" className="section section--tall">
      <div className="wrap hero" id="start">
        <div className="hero__copy">
          <p className="label">{closing.label}</p>
          <h2 className="display hero__headline">{closing.headline}</h2>
          <p className="lede hero__sub">{closing.sub}</p>
        </div>
        <div className="hero__form">
          <LeadForm source="closing" cta="Send it" />
        </div>
      </div>
    </section>
  );
}
