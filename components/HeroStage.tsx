"use client";

import { useEffect, useRef } from "react";
import { emit } from "@/lib/bus";
import LeadForm from "./LeadForm";
import Screen from "./Screen";
import { Ticker } from "./Sections";
import { hero } from "@/content/site";

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
      // Wide screens: the form is its own sticky column beside the story; no
      // hold. The phone starts beneath the line: push it down until its top
      // sits at the band at scroll 0, so it only appears once you scroll.
      if (window.innerWidth >= 1024) {
        hold.style.height = "";
        const topH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--top-h")) || 60;
        const bandH = band.offsetHeight;
        // The title stays put: it sticks at its own resting position, and the
        // sub and the points scroll up beneath it. The phone rises to rest
        // under the title, no taller than the form beside it.
        const head = el.querySelector<HTMLElement>(".hero-stage__head");
        const title = el.querySelector<HTMLElement>(".hero-stage__title");
        if (head && title && stage) {
          const headTop = head.getBoundingClientRect().top + window.scrollY;
          const titleTop = headTop + (parseFloat(getComputedStyle(head).paddingTop) || 0);
          // The title shrinks as the phone arrives: measure it at its final size.
          const pvNow = el.style.getPropertyValue("--pv");
          el.style.setProperty("--pv", "1");
          const titleH = title.offsetHeight;
          el.style.setProperty("--pv", pvNow || "0");
          const gap = 24;
          const phoneTop = titleTop + titleH + gap;
          const formBottom = topH + 20 + form.offsetHeight;
          const room = Math.min(formBottom - phoneTop, window.innerHeight - bandH - phoneTop - 12);
          el.style.setProperty("--title-top", `${Math.round(titleTop)}px`);
          el.style.setProperty("--phone-top", `${Math.round(phoneTop)}px`);
          // Size by height: the bezel's aspect comes from the element itself.
          const screen = stage.querySelector<HTMLElement>(".screen");
          el.style.setProperty("--phone-w", "200px");
          const ratio = screen && screen.offsetWidth ? stage.offsetHeight / screen.offsetWidth : 16 / 9;
          el.style.setProperty("--phone-w", `${Math.floor(Math.max(260, room) / ratio)}px`);
          // Everything parked (title, form, phone) lets go together with the
          // band: the column ends under the phone by exactly the phone's
          // distance below the title, and the section ends one screen later.
          const phoneBottom = phoneTop + stage.offsetHeight;
          el.style.setProperty("--head-pad", `${Math.round(phoneBottom - (titleTop + titleH))}px`);
          el.style.setProperty("--char-room", `${Math.round(Math.max(90, window.innerHeight - bandH - phoneBottom))}px`);
        }
        if (stage) {
          // Measured un-stuck: the phone starts beneath the line at scroll 0.
          stage.style.marginTop = "";
          stage.style.position = "static";
          const natural = stage.getBoundingClientRect().top + window.scrollY;
          stage.style.position = "";
          const want = window.innerHeight - bandH + 40;
          stage.style.marginTop = `${Math.max(36, Math.round(want - natural))}px`;
        }
        return;
      }
      if (stage) stage.style.marginTop = "";
      for (const v of ["--title-top", "--phone-top", "--phone-w", "--head-pad", "--char-room"]) el.style.removeProperty(v);
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
    window.addEventListener("load", onResize);
    const ro = new ResizeObserver(onResize);
    if (form) ro.observe(form);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("load", onResize);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      document.documentElement.classList.remove("form-focus");
    };
  }, []);

  return (
    <section className="hero-stage" id="quote" ref={ref}>
      <div className="hero-stage__flow">
        <div className="hero-stage__head">
          <div className="hero-stage__title">
            <h1 className="h1">
              <Highlight text={hero.headline} />
              <span className="dot" aria-hidden="true" />
            </h1>
          </div>
          <p className="body hero__sub">{hero.sub}</p>
        </div>

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
