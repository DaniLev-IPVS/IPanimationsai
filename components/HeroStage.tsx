"use client";

import { useEffect, useRef } from "react";
import { emit } from "@/lib/bus";
import LeadForm from "./LeadForm";
import Screen from "./Screen";
import { Ticker } from "./Sections";
import { hero } from "@/content/site";

/**
 * The hero stage. A band made of the ground line and the scrolling banner
 * sticks to the bottom of the screen for the whole section, and the
 * character stands on it. Everything else is ordinary flow that scrolls up
 * from beneath that line: the form (large, and held briefly), the three
 * points, then the phone, which grows from 60% and loses its blur as it
 * rises. When the section ends the band scrolls away and he jumps in.
 *
 * --pv on the section is the phone's rise, 0 (under the line) to 1 (fully
 * up). The character engine reads it; the styles do the phone's transform.
 */
export default function HeroStage() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = el.querySelector<HTMLElement>(".hero-stage__hold");
    const form = el.querySelector<HTMLElement>(".hero__form");
    const stage = el.querySelector<HTMLElement>(".stage");
    const band = el.querySelector<HTMLElement>(".hero-band");
    let raf = 0;
    let screenOn = false;
    let focus: boolean | null = null;

    // How long the form holds: until the points, rising from under the line,
    // would reach the gap beneath it. Then it scrolls on with them.
    const layout = () => {
      if (!hold || !form || !band) return;
      const topH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--top-h")) || 60;
      const gap = parseFloat(getComputedStyle(el).getPropertyValue("--points-gap")) || 40;
      const bandH = band.offsetHeight;
      const formH = form.offsetHeight;
      const room = window.innerHeight - bandH - (topH + 12 + formH) - gap;
      hold.style.height = reduced ? "auto" : `${formH + Math.max(0, Math.min(room, window.innerHeight * 0.45))}px`;
    };

    const tick = () => {
      raf = 0;
      const topH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--top-h")) || 60;
      const r = el.getBoundingClientRect();
      const bandTop = band ? band.getBoundingClientRect().top : window.innerHeight;
      // Phone rise: 0 while its layout box is under the line, 1 once fully above it.
      let pv = 1;
      if (stage && !reduced) {
        const s = stage.getBoundingClientRect(); // untransformed wrapper
        pv = Math.min(1, Math.max(0, (bandTop - s.top) / Math.max(1, s.height)));
      }
      el.style.setProperty("--pv", pv.toFixed(4));
      if (!screenOn && pv > 0.7) {
        screenOn = true;
        emit("screen:on");
      }
      // Header button steps back while the form is on screen; the phone-only
      // bottom bar waits until the band has released.
      const fr = form?.getBoundingClientRect();
      document.documentElement.classList.toggle("form-focus", !!fr && fr.bottom > topH && fr.top < window.innerHeight);
      const f = r.bottom > window.innerHeight - 1;
      if (f !== focus) {
        focus = f;
        emit("form:focus", f);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onResize = () => {
      layout();
      onScroll();
    };
    layout();
    tick();
    document.fonts?.ready.then(onResize).catch(() => {});
    const ro = new ResizeObserver(onResize);
    if (form) ro.observe(form);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      document.documentElement.classList.remove("form-focus");
    };
  }, []);

  return (
    <section className="hero-stage" id="quote" ref={ref}>
      <div className="hero-stage__flow">
        <div className="hero-stage__hold">
          <div className="hero__form" id="lead-form">
            <p className="body hero__formlead">{hero.formLead}</p>
            <LeadForm source="hero" cta={hero.cta} />
            <ul className="trust" aria-label="Clients and results">
              {hero.trust.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>

        <ul className="offer offer--stage">
          {hero.offer.map((o) => (
            <li key={o.title} className="offer__item">
              <span className="offer__text">
                <strong>{o.title}</strong>
                {o.body}
              </span>
            </li>
          ))}
        </ul>

        <div className="stage" id="stage">
          <Screen />
        </div>
      </div>

      {/* The band: ground line + banner, stuck to the bottom of the screen. He stands on the line. */}
      <div className="hero-band">
        <div className="hero__ground" id="stage-ground" aria-hidden="true" />
        <div className="hole" id="hole" aria-hidden="true">
          <span className="hole__rim" />
        </div>
        <Ticker />
      </div>
    </section>
  );
}
