"use client";

import { useEffect, useRef } from "react";
import { brand } from "@/content/site";

/**
 * The lockup, ported from the brand kit's animated logo:
 * the IP Ventures mark, "IP", and "animations" with every letter riding a
 * frozen wave. In the colour variant an Ink ball bounces along the tops of
 * the letters once on load (the kit's "Wave" variant, one pass), squashing
 * each letter as it passes. The last frame is the static logo.
 */

const LETTERS = "animations".split("");
const COLOURS = [
  "var(--logo-sunbeam)",
  "var(--logo-bubblegum)",
  "var(--logo-mint)",
  "var(--logo-sky)",
  "var(--logo-tangerine)",
  "var(--logo-grape)",
  "var(--logo-sunbeam)",
  "var(--logo-bubblegum)",
  "var(--logo-mint)",
  "var(--logo-sky)",
];
const WAVE = [0, -0.12, -0.19, -0.12, 0, 0.12, 0.19, 0.12, 0, -0.12];
const STEP_MS = 380;

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="128 56 434 297" className={className} aria-hidden="true">
      <g style={{ strokeWidth: 26, strokeLinejoin: "round" }} fill="currentColor" stroke="currentColor">
        <path d="M383.819 81L345.736 162.287H230.638L268.721 81H383.819Z" />
        <path d="M204.437 218.221H319.535L268.098 328H153L204.437 218.221Z" />
        <path d="M537 162.287H421.902L383.819 81H498.917L537 162.287Z" />
        <path d="M383.819 243.574H498.917L537 162.287H421.902L383.819 243.574Z" />
      </g>
    </svg>
  );
}

export default function Logo({
  variant = "colour",
  animate = false,
  className,
}: {
  variant?: "colour" | "mono";
  /** Play one Wave pass on mount. */
  animate?: boolean;
  className?: string;
}) {
  const wordRef = useRef<HTMLSpanElement>(null);
  const ballRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!animate || variant !== "colour") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const word = wordRef.current;
    const ball = ballRef.current;
    if (!word || !ball) return;

    let cancelled = false;
    const run = async () => {
      try {
        await document.fonts?.ready;
      } catch {}
      if (cancelled) return;
      const letters = Array.from(word.querySelectorAll<HTMLElement>("[data-letter]"));
      if (!letters.length) return;
      const wordBox = word.getBoundingClientRect();
      const r = ball.getBoundingClientRect().width / 2 || 4;

      // Keyframes: hop from letter top to letter top, never touching them.
      const frames = letters.map((el) => {
        const b = el.getBoundingClientRect();
        return {
          x: b.left - wordBox.left + b.width / 2 - r,
          y: b.top - wordBox.top - r * 2 - 2,
        };
      });
      const keyframes: Keyframe[] = [];
      frames.forEach((f, i) => {
        const t0 = i / frames.length;
        const t1 = (i + 0.5) / frames.length;
        keyframes.push({ transform: `translate(${f.x}px, ${f.y}px)`, offset: t0 });
        keyframes.push({
          transform: `translate(${f.x + (frames[i + 1] ? (frames[i + 1].x - f.x) / 2 : 0)}px, ${f.y - 10}px)`,
          offset: Math.min(t1, 0.999),
        });
      });
      const last = frames[frames.length - 1];
      keyframes.push({ transform: `translate(${last.x}px, ${last.y}px)`, offset: 1 });

      ball.style.opacity = "1";
      const anim = ball.animate(keyframes, {
        duration: STEP_MS * frames.length,
        easing: "linear",
        fill: "forwards",
      });
      letters.forEach((el, i) => {
        el.animate(
          [
            { transform: `translateY(${WAVE[i]}em) scaleY(1)` },
            { transform: `translateY(${WAVE[i] + 0.06}em) scaleY(0.82)` },
            { transform: `translateY(${WAVE[i]}em) scaleY(1)` },
          ],
          { duration: 220, delay: i * STEP_MS + 40, easing: "ease-out", fill: "none" },
        );
      });
      anim.onfinish = () => {
        if (ball) ball.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" });
      };
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [animate, variant]);

  return (
    <span className={`logo logo--${variant} ${className ?? ""}`} aria-label={brand.name}>
      <Mark className="logo__mark" />
      <span className="logo__ip">IP</span>
      <span className="logo__word" ref={wordRef}>
        {LETTERS.map((ch, i) => (
          <span
            key={i}
            data-letter
            className="logo__letter"
            style={{
              color: variant === "colour" ? COLOURS[i] : "currentColor",
              transform: `translateY(${WAVE[i]}em)`,
            }}
          >
            {ch}
          </span>
        ))}
        <span className="logo__ball" ref={ballRef} aria-hidden="true" />
      </span>
    </span>
  );
}
