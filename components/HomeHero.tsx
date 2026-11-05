"use client";

import { useEffect, useRef } from "react";
import { emit } from "@/lib/bus";
import Screen from "./Screen";
import { LogoStrip } from "./Sections";
import { hero, bookCall } from "@/content/site";

/** "==word==" → highlighted word. The closing dot is added by the caller. */
function Highlight({ text }: { text: string }) {
  return (
    <>
      {text.split(/(==[^=]+==)/g).map((p, i) =>
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

/**
 * The homepage hero: headline, the three points and one button to /book on
 * the left, the showreel phone on the right. Below it, the band the character
 * stands on, with the client logos running along it. (The form lives on /book.)
 *
 * It keeps the stage's hooks (#quote, .hero-band, #stage-ground, #hole) so the
 * character engine works unchanged; he points at the button.
 */
export default function HomeHero() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cta = el.querySelector<HTMLElement>(".hero-home__cta");
    const phone = el.querySelector<HTMLElement>(".hero-home__phone");
    let raf = 0;
    let focus: boolean | null = null;

    let screenOn = false;

    const tick = () => {
      raf = 0;
      // The reel starts playing once the phone is mostly on screen.
      if (!screenOn && phone) {
        const p = phone.getBoundingClientRect();
        const seen = Math.min(p.bottom, window.innerHeight) - Math.max(p.top, 0);
        if (seen > p.height * 0.4) {
          screenOn = true;
          emit("screen:on");
        }
      }
      const topH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--top-h")) || 60;
      // Header button steps back while the hero's own button is on screen;
      // the phone-only bottom bar waits until the band has scrolled away.
      const b = cta?.getBoundingClientRect();
      document.documentElement.classList.toggle("form-focus", !!b && b.bottom > topH && b.top < window.innerHeight);
      const f = el.getBoundingClientRect().bottom > window.innerHeight - 1;
      if (f !== focus) {
        focus = f;
        emit("form:focus", f);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      document.documentElement.classList.remove("form-focus");
    };
  }, []);

  return (
    <section className="hero-stage hero-home" id="quote" ref={ref}>
      <div className="hero-home__grid">
        <div className="hero-home__copy">
          <h1 className="h1">
            <Highlight text={hero.headline} />
            <span className="dot" aria-hidden="true" />
          </h1>
          <p className="body hero__sub">{hero.sub}</p>
          <ul className="offer hero-home__offer">
            {hero.offer.map((o) => (
              <li key={o.title} className="offer__item">
                <span className="offer__text">
                  <strong>{o.title}</strong>
                  {o.body}
                </span>
              </li>
            ))}
          </ul>
          <a href="/book" className="btn btn--lg hero-home__cta">
            {bookCall.button}
            <span aria-hidden="true">→</span>
          </a>
        </div>
        <div className="hero-home__phone">
          <Screen />
        </div>
      </div>

      {/* The band: ground line + the client logos. He stands on the line. */}
      <div className="hero-band">
        <div className="hero__ground" id="stage-ground" aria-hidden="true" />
        <div className="hole" id="hole" aria-hidden="true">
          <span className="hole__rim" />
        </div>
        <LogoStrip />
      </div>
    </section>
  );
}
