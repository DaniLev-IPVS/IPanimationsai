"use client";

/**
 * The Stage: a fixed flat-2D background that persists behind the whole page.
 *
 * It is NOT pinned and it does NOT hijack scrolling — the content scrolls over
 * it normally. The stage simply changes what it is performing depending on
 * which section is currently in front of it, and goes deliberately quiet under
 * the testimonials so the quotes can breathe.
 */

import { useEffect, useRef, useState } from "react";
import WalkCycle from "./WalkCycle";

type Scene = "hero" | "testimonials" | "reel" | "closing";

const ACCENT: Record<Scene, string> = {
  hero: "var(--ember)",
  testimonials: "var(--cobalt)",
  reel: "var(--acid)",
  closing: "var(--ember)",
};

/** Flat shapes that slide past the walker so they read as forward motion. */
const DRIFT = [
  { kind: "bar", top: "58%", size: 260, dur: 9, delay: 0, o: 0.08 },
  { kind: "circle", top: "26%", size: 90, dur: 17, delay: -4, o: 0.1 },
  { kind: "square", top: "68%", size: 54, dur: 12, delay: -7, o: 0.09 },
  { kind: "circle", top: "78%", size: 150, dur: 22, delay: -2, o: 0.06 },
  { kind: "tri", top: "38%", size: 70, dur: 14, delay: -11, o: 0.08 },
] as const;

export default function Stage() {
  const [scene, setScene] = useState<Scene>("hero");
  const [band, setBand] = useState<{ top: number; height: number } | null>(null);
  /** Viewport y of the ground line each tall section reserves for the walker. */
  const [ground, setGround] = useState<{ hero: number; closing: number }>({
    hero: -9999,
    closing: -9999,
  });
  const [y, setY] = useState(0);
  const ticking = useRef(false);

  useEffect(() => {
    const ids: Scene[] = ["hero", "testimonials", "reel", "closing"];

    const measure = () => {
      ticking.current = false;
      const mid = window.innerHeight / 2;

      // Which section is in front of the stage right now?
      let active: Scene = "hero";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) active = id;
      }
      setScene(active);
      setY(window.scrollY);

      // The ground line sits in the strip each tall section reserves at its
      // foot. Measured, never guessed in vh — otherwise the walker walks
      // straight through the headline on short screens.
      // Pinned to the foot of the viewport: the form makes these sections
      // taller than one screen, and a walker parked below the fold would mean
      // nothing is moving when the page first paints.
      const line = window.innerHeight - GROUND_INSET;
      setGround({ hero: line, closing: line });

      // Align the dark band to the reel section exactly, so it reads as a real
      // band scrolling past rather than a crossfade.
      const reelEl = document.getElementById("reel");
      if (reelEl) {
        const r = reelEl.getBoundingClientRect();
        setBand(
          r.bottom > -200 && r.top < window.innerHeight + 200
            ? { top: r.top, height: r.height }
            : null,
        );
      }
    };

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Publish the live accent to the whole document.
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", ACCENT[scene]);
  }, [scene]);

  return (
    <div className="stage" aria-hidden="true">
      {/* ── 1 · HERO — the walk cycle, always moving ───────────────────── */}
      <div className="stage__scene" style={{ opacity: scene === "hero" ? 1 : 0 }}>
        {DRIFT.map((d, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: d.top,
              left: 0,
              opacity: d.o,
              animation: `drift ${d.dur}s linear ${d.delay}s infinite`,
            }}
          >
            <Shape kind={d.kind} size={d.size} />
          </div>
        ))}

        <Ground y={ground.hero} />
        <div className="stage__walkbox" style={{ top: ground.hero }}>
          <WalkCycle className="stage__walker" />
        </div>
      </div>

      {/* ── 2 · TESTIMONIALS — near silence, a few bubbles ─────────────── */}
      <div
        className="stage__scene"
        style={{ opacity: scene === "testimonials" ? 1 : 0 }}
      >
        {[
          { left: "8%", size: 120, dur: 19, delay: 0 },
          { left: "78%", size: 90, dur: 23, delay: -8 },
          { left: "62%", size: 52, dur: 27, delay: -15 },
        ].map((b, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: b.left,
              top: "42%",
              animation: `rise ${b.dur}s linear ${b.delay}s infinite`,
            }}
          >
            <Bubble size={b.size} />
          </div>
        ))}
      </div>

      {/* ── 3 · REEL — the one dark band, aligned to the section ───────── */}
      {band && (
        <div
          className="stage__band"
          style={{ transform: `translate3d(0, ${band.top}px, 0)`, height: band.height }}
        >
          {/* projector wedge */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "-12%",
              width: "44%",
              height: "52%",
              background: "var(--acid)",
              opacity: 0.07,
              clipPath: "polygon(0 0, 26% 0, 100% 100%, 0 62%)",
              animation: "flicker 5.5s ease-in-out infinite",
            }}
          />
          {/* film perforations creeping down both edges */}
          {["left", "right"].map((side) => (
            <div
              key={side}
              style={{
                position: "absolute",
                [side]: 10,
                top: -80,
                bottom: -80,
                width: 22,
                animation: "creep 2.6s linear infinite",
                backgroundImage:
                  "repeating-linear-gradient(to bottom, rgba(244,241,234,0.22) 0 14px, transparent 14px 40px)",
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      {/* ── 4 · CLOSING — the walker returns, pointing at the form ─────── */}
      <div
        className="stage__scene"
        style={{ opacity: scene === "closing" ? 1 : 0 }}
      >
        <Ground y={ground.closing} />
        <div
          className="stage__walkbox stage__walkbox--right"
          style={{ top: ground.closing }}
        >
          <WalkCycle className="stage__walker stage__walker--mirrored" />
        </div>
      </div>

      {/* ── travellers: drift through the whole page at 0.45x scroll ───── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate3d(0, ${-y * 0.45}px, 0)`,
          willChange: "transform",
        }}
      >
        <Traveller top="118vh" left="6%" rotate={-12} size={46} kind="plane" />
        <Traveller top="196vh" left="86%" rotate={22} size={38} kind="pencil" />
        <Traveller top="312vh" left="12%" rotate={0} size={42} kind="play" />
      </div>
    </div>
  );
}

/* ── flat primitives — no gradients, no shadows ──────────────────────────── */

/** How far above the foot of the viewport the ground line sits. */
const GROUND_INSET = 90;

function Ground({ y }: { y: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: y,
        height: 2,
        background: "var(--ink)",
        opacity: 0.16,
      }}
    />
  );
}

function Shape({ kind, size }: { kind: string; size: number }) {
  const ink = "var(--ink)";
  if (kind === "circle")
    return <div style={{ width: size, height: size, borderRadius: "50%", background: ink }} />;
  if (kind === "square")
    return <div style={{ width: size, height: size, background: ink }} />;
  if (kind === "bar")
    return <div style={{ width: size, height: 10, borderRadius: 5, background: ink }} />;
  return (
    <div
      style={{
        width: 0,
        height: 0,
        borderLeft: `${size / 2}px solid transparent`,
        borderRight: `${size / 2}px solid transparent`,
        borderBottom: `${size}px solid ${ink}`,
      }}
    />
  );
}

function Bubble({ size }: { size: number }) {
  return (
    <svg
      className="stage__bubble"
      style={{ ["--bubble" as string]: `${size}px` }}
      viewBox="0 0 100 82"
      fill="none"
    >
      <path
        d="M10 4h80a6 6 0 0 1 6 6v44a6 6 0 0 1-6 6H40L18 78V60h-8a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6z"
        stroke="var(--ink)"
        strokeWidth="4"
        opacity="0.22"
      />
    </svg>
  );
}

function Traveller({
  top,
  left,
  rotate,
  size,
  kind,
}: {
  top: string;
  left: string;
  rotate: number;
  size: number;
  kind: "plane" | "pencil" | "play";
}) {
  const paths: Record<typeof kind, string> = {
    plane: "M2 12 46 2 30 46 22 28z",
    pencil: "M6 42 10 30 34 6l8 8-24 24z",
    play: "M8 4 44 24 8 44z",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      style={{ position: "absolute", top, left, transform: `rotate(${rotate}deg)` }}
      fill="none"
    >
      <path
        d={paths[kind]}
        stroke="var(--ink)"
        strokeWidth="3"
        strokeLinejoin="round"
        opacity="0.2"
      />
    </svg>
  );
}
