"use client";

import { useEffect, useRef } from "react";
import { emit } from "@/lib/bus";
import LeadForm from "./LeadForm";
import Screen from "./Screen";
import { hero } from "@/content/site";

/**
 * The pinned stage under the headline. A viewport-high panel sticks to the
 * header while the section scrolls for ~1.4 screens; that scroll budget is
 * the choreography:
 *
 *   p 0.00–0.30  the form holds, crisp, the only thing on screen
 *   p 0.30–0.75  the form lifts away and fades
 *   p 0.25–0.85  the phone rises from behind the ground line, grows from
 *                60%, loses its blur and dimming, and starts playing at 0.7
 *   (the character walks from his pointing spot to the hole over the same
 *    stretch; that lives in the character engine)
 *
 * Progress is written to CSS variables on the section; the styles do the
 * rest, so this never re-renders React per frame.
 */
export default function HeroStage() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let screenOn = false;
    let focus: boolean | null = null;

    const tick = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const topH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--top-h")) || 60;
      const pinH = window.innerHeight - topH;
      const budget = Math.max(1, r.height - pinH);
      // 0 when the panel pins, 1 when the section releases it.
      const p = reduced ? 1 : Math.min(1, Math.max(0, (topH - r.top) / budget));
      const pf = Math.min(1, Math.max(0, (p - 0.3) / 0.45));
      const pv = Math.min(1, Math.max(0, (p - 0.25) / 0.6));
      el.style.setProperty("--p", p.toFixed(4));
      el.style.setProperty("--pf", pf.toFixed(4));
      el.style.setProperty("--pv", pv.toFixed(4));
      if (!screenOn && pv > 0.7) {
        screenOn = true;
        emit("screen:on");
      }
      // Header button steps back while the form is the focus; the phone-only
      // bottom bar waits until the stage has released entirely.
      document.documentElement.classList.toggle("form-focus", pf < 0.5 && r.bottom > topH);
      const f = p < 0.995 && r.bottom > topH;
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
    <section className="hero-stage" id="quote" ref={ref}>
      <div className="hero-stage__pin">
        <div className="hero__form" id="lead-form">
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

        {/* The hole sits on the ground line at the right edge, positioned by the character engine. */}
        <div className="hole" id="hole" aria-hidden="true">
          <span className="hole__rim" />
        </div>
        <div className="hero__ground" id="stage-ground" aria-hidden="true" />
      </div>
    </section>
  );
}
