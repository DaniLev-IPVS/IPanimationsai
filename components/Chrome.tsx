"use client";

import { useEffect, useState } from "react";
import { brand } from "@/content/site";
import { on } from "@/lib/bus";
import Logo from "./Logo";

export function Header() {
  return (
    <header className="top">
      <a href="#top" className="top__logo" aria-label={`${brand.name} — home`}>
        <Logo variant="colour" animate />
      </a>
      <nav className="top__nav">
        <a href="#work" className="top__link">
          Our work
        </a>
        <a href="#quote" className="btn btn--sm top__cta">
          {brand.book}
        </a>
      </nav>
    </header>
  );
}

/**
 * Phone only: a bottom bar with the CTA that appears once the form has
 * scrolled out of view, and hides while the keyboard is up.
 */
export function StickyCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let formVisible = true;
    let keyboard = false;
    const update = () => setShow(!formVisible && !keyboard);

    // The hero stage says when the form is the focus; otherwise the bar shows.
    const off = on("form:focus", (f) => {
      formVisible = f;
      update();
    });

    const vv = window.visualViewport;
    const onVV = () => {
      if (!vv) return;
      keyboard = vv.height < window.innerHeight * 0.75;
      update();
    };
    vv?.addEventListener("resize", onVV);
    return () => {
      off();
      vv?.removeEventListener("resize", onVV);
    };
  }, []);

  return (
    <div className={`stickycta ${show ? "is-on" : ""}`} aria-hidden={!show}>
      <a href="#quote" className="btn btn--block" tabIndex={show ? 0 : -1}>
        {brand.book}
      </a>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="foot" id="footer">
      {/* The landing zone: open ground he drops onto. */}
      <div className="foot__sky" aria-hidden="true" />
      <div className="foot__ground" id="footer-ground" data-platform aria-hidden="true" />
      <div className="wrap foot__row">
        <Logo variant="mono" className="foot__logo" />
        <div className="foot__meta">
          <a href={`mailto:${brand.email}`} className="foot__mail">
            {brand.email}
          </a>
          <span className="foot__dim">
            {brand.domain} · {brand.tagline}
          </span>
        </div>
        <a href="#quote" className="btn btn--sm foot__cta" id="footer-cta">
          {brand.book}
        </a>
      </div>
    </footer>
  );
}
