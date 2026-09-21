import { hero, testimonials, reel, closing, type ReelItem } from "@/content/site";
import LeadForm from "./LeadForm";

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

        {testimonials.isPlaceholder && (
          <p className="placeholder-note">
            Placeholder copy — replace with real, attributable quotes before this
            page takes paid traffic.
          </p>
        )}

        <div className="quotes">
          {testimonials.items.map((t, i) => (
            <figure className="quote" key={i}>
              <span className="quote__mark" aria-hidden="true">
                &ldquo;
              </span>
              <blockquote className="quote__body">{t.quote}</blockquote>
              <figcaption className="quote__by label">
                {t.name} — {t.role}, {t.company}
                <span className="quote__work">{t.work}</span>
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
            <ReelCard key={item.slot} item={item} ratio="16 / 9" />
          ))}
        </div>

        <div className="reel__wall">
          {reel.verticals.map((item) => (
            <ReelCard key={item.slot} item={item} ratio="9 / 16" />
          ))}
        </div>

        <p className="reel__closer">{reel.closer}</p>
      </div>
    </section>
  );
}

function ReelCard({ item, ratio }: { item: ReelItem; ratio: string }) {
  const filled = Boolean(item.youtubeId);
  return (
    <figure className="card">
      <div className="card__frame" style={{ aspectRatio: ratio }}>
        {filled ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}`}
            title={item.blurb}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <EmptySlot slot={item.slot} />
        )}
      </div>
      <figcaption className="card__cap">
        <span className="label card__tech">{item.technique}</span>
        <span className="card__blurb">{item.blurb}</span>
      </figcaption>
    </figure>
  );
}

/**
 * An empty reel slot still moves. A static grey box would be a bad advert for
 * an animation studio, so each placeholder runs its own small flat loop until
 * a real video replaces it.
 */
function EmptySlot({ slot }: { slot: string }) {
  const variant = Number(slot.replace(/\D/g, "")) % 3;
  return (
    <div className="slot">
      <svg viewBox="0 0 100 100" className="slot__art" aria-hidden="true">
        {variant === 0 && (
          <circle cx="50" cy="50" r="13" fill="var(--acid)">
            <animate
              attributeName="r"
              values="13;22;13"
              dur="2.6s"
              repeatCount="indefinite"
            />
          </circle>
        )}
        {variant === 1 && (
          <rect x="37" y="37" width="26" height="26" fill="var(--acid)">
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 50 50;90 50 50"
              dur="2.2s"
              repeatCount="indefinite"
            />
          </rect>
        )}
        {variant === 2 && (
          <g fill="var(--acid)">
            <rect x="28" y="44" width="10" height="12">
              <animate attributeName="height" values="12;30;12" dur="1.6s" repeatCount="indefinite" />
            </rect>
            <rect x="45" y="44" width="10" height="12">
              <animate attributeName="height" values="12;30;12" dur="1.6s" begin="0.25s" repeatCount="indefinite" />
            </rect>
            <rect x="62" y="44" width="10" height="12">
              <animate attributeName="height" values="12;30;12" dur="1.6s" begin="0.5s" repeatCount="indefinite" />
            </rect>
          </g>
        )}
      </svg>
      <span className="label slot__id">SLOT {slot} — AWAITING LINK</span>
    </div>
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
