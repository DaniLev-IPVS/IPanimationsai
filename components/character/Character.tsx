"use client";

import { useEffect, useRef } from "react";
import { Director, type Layout, type Platform, type Wall } from "./director";
import { solve, GROUND_Y, HEAD_R, POSES, type PoseName, clamp } from "./rig";
import { emit, on } from "@/lib/bus";

/**
 * Mounts one fixed SVG layer and drives it with the Director at 60fps.
 * Everything per-frame happens through refs and direct attribute writes;
 * React only mounts the skeleton once.
 *
 * Debug: add ?pose=heroLand (any PoseName) to freeze him mid-screen.
 */
export default function Character() {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const refs = useRef<Record<string, SVGElement | null>>({});
  const set = (k: string) => (el: SVGElement | null) => {
    refs.current[k] = el;
  };

  useEffect(() => {
    const svg = svgRef.current, g = gRef.current;
    if (!svg || !g) return;
    const R = refs.current;
    const director = new Director();
    const reducedMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
    director.reduced = reducedMQ.matches;
    director.onScreenOn = () => {
      emit("screen:on");
      document.getElementById("screen-switch")?.classList.add("is-on");
    };

    const debugPose = new URLSearchParams(location.search).get("pose") as PoseName | null;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __char: Director }).__char = director;

    /* ── measurement ─────────────────────────────────────────────── */
    const measure = () => {
      const vw = window.innerWidth, vh = window.innerHeight, sy = window.scrollY;
      const rect = (id: string) => document.getElementById(id)?.getBoundingClientRect();
      const ground = rect("stage-ground"), holeEl = document.getElementById("hole"), sw = rect("screen-switch"),
        screen = rect("screen"), fg = rect("footer-ground"), work = rect("work"), wrap = document.querySelector(".hero__grid")?.getBoundingClientRect();
      if (!ground || !holeEl || !fg || !work) return;
      const isMobile = vw < 768;
      const scale = isMobile ? 0.27 : vw < 1100 ? 0.4 : 0.46;
      // The page's side margin. If the character fits in it he falls down the
      // right margin in front of everything; otherwise he falls behind the
      // content along the right edge and peeks out between the cards.
      const gutter = wrap ? wrap.left : 0;
      const behind = gutter < 120 * scale + 12;
      const laneX = behind ? (isMobile ? vw - 36 : vw - 64) : vw - gutter / 2;
      const contentRight = wrap ? wrap.right : vw - gutter;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
      const heroGround = ground.top + sy;
      const footerGround = fg.top + sy;
      // One lane for everything: he stands just left of the hole, hops in,
      // falls down the lane, lands in it, and climbs back up it.
      const holeX = laneX;
      const standX = laneX - 78 * scale;
      const switchX = sw ? sw.left + sw.width / 2 : (screen?.right ?? 0);
      const emergeX = (screen?.right ?? 0) - 14;
      const footerX = laneX;
      const holeW = holeEl.getBoundingClientRect().width || 56;
      holeEl.style.left = `${Math.round(holeX - holeW / 2)}px`;

      // Platforms: anything flagged, between the two grounds, one per row, nearest the lane.
      const els = Array.from(document.querySelectorAll<HTMLElement>("[data-platform]"));
      const rows: { docY: number; left: number; right: number }[] = [];
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width < 40 || r.height === 0) continue;
        const docY = r.top + sy;
        if (docY <= heroGround + 20 || docY >= footerGround - 20) continue;
        const near = rows.find((row) => Math.abs(row.docY - docY) < 36);
        const cand = { docY, left: r.left, right: r.right };
        if (!near) rows.push(cand);
        else {
          const d = (c: typeof cand) => (laneX < c.left ? c.left - laneX : laneX > c.right ? laneX - c.right : 0);
          if (d(cand) < d(near)) Object.assign(near, cand);
        }
      }
      rows.sort((a, b) => b.docY - a.docY);
      const platforms: Platform[] = [{ docY: footerGround, x: footerX }];
      for (const row of rows) {
        const last = platforms[platforms.length - 1];
        if (last.docY - row.docY < 70 * scale + 40) continue; // too close to the one below
        platforms.push({ docY: row.docY, x: clamp(laneX, row.left + 24, row.right - 24) });
      }
      platforms.push({ docY: heroGround, x: standX });

      // Walls: content boxes whose right edge is near the lane.
      const walls: Wall[] = [];
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width < 40 || r.height < 20) continue;
        if (r.right < contentRight - 120) continue;
        walls.push({ top: r.top + sy, bottom: r.bottom + sy, right: r.right });
      }

      const layout: Layout = { vw, vh, maxScroll, scale, behind, laneX, standX, holeX, switchX, emergeX, heroGround, footerGround, footerX, workTop: work.top + sy, contentRight, walls, platforms };
      director.layout = layout;
      svg.classList.toggle("is-front", !behind);
    };

    let measureTimer = 0;
    const scheduleMeasure = () => {
      window.clearTimeout(measureTimer);
      measureTimer = window.setTimeout(measure, 120);
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
    window.addEventListener("resize", scheduleMeasure);
    const ro = new ResizeObserver(scheduleMeasure);
    ro.observe(document.body);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          director.startIntro(performance.now());
          io.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px 0px -24px 0px" },
    );
    // The intro starts once the ground line he walks along is on screen.
    const groundEl = document.getElementById("stage-ground");
    if (groundEl) io.observe(groundEl);

    const offLead = on("lead:sent", () => director.celebrate(performance.now()));
    const onMouse = (e: MouseEvent) => director.setMouse(e.clientX, e.clientY);
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) window.addEventListener("mousemove", onMouse, { passive: true });
    const onMQ = () => (director.reduced = reducedMQ.matches);
    reducedMQ.addEventListener?.("change", onMQ);

    /* ── render loop ─────────────────────────────────────────────── */
    let raf = 0;
    let frames = 0, slow = 0, lastTick = 0;
    const pt = (p: [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      // Cheap self-profiling: if frames keep arriving late, degrade.
      if (lastTick) {
        const gap = now - lastTick;
        if (gap > 34) slow++;
        if (++frames === 120) {
          if (slow > 40) {
            if (director.lowPower) director.reduced = true;
            director.lowPower = true;
          }
          frames = 0; slow = 0;
        }
      }
      lastTick = now;

      let f = director.update(now, window.scrollY);
      if (!f) return;
      const L = director.layout!;
      if (debugPose && POSES[debugPose]) {
        f = { ...f, x: L.vw / 2, y: L.vh / 2 + 100, pose: POSES[debugPose], opacity: 1, face: 1 };
      }

      const s = L.scale;
      const sk = solve(f.pose);
      g.setAttribute("transform", `translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) scale(${(s * f.face * f.pose.sx).toFixed(3)} ${(s * f.pose.sy).toFixed(3)}) translate(-60 -${GROUND_Y})`);
      g.style.opacity = String(f.opacity);
      svg.classList.toggle("is-dark", f.dark);

      (R.legL as SVGPolylineElement).setAttribute("points", `${pt(sk.hip)} ${pt(sk.kneeL)} ${pt(sk.footL)}`);
      (R.armL as SVGPolylineElement).setAttribute("points", `${pt(sk.shoulder)} ${pt(sk.elbowL)} ${pt(sk.handL)}`);
      (R.legR as SVGPolylineElement).setAttribute("points", `${pt(sk.hip)} ${pt(sk.kneeR)} ${pt(sk.footR)}`);
      (R.armR as SVGPolylineElement).setAttribute("points", `${pt(sk.shoulder)} ${pt(sk.elbowR)} ${pt(sk.handR)}`);
      const torso = R.torso as SVGLineElement;
      torso.setAttribute("x1", sk.shoulder[0].toFixed(1)); torso.setAttribute("y1", sk.shoulder[1].toFixed(1));
      torso.setAttribute("x2", sk.hip[0].toFixed(1)); torso.setAttribute("y2", sk.hip[1].toFixed(1));
      const head = R.head as SVGCircleElement;
      head.setAttribute("cx", sk.head[0].toFixed(1)); head.setAttribute("cy", sk.head[1].toFixed(1));

      const shadow = R.shadow as SVGEllipseElement;
      shadow.style.opacity = String(f.shadow * 0.18);
      shadow.setAttribute("rx", String(24 * f.pose.sx));

      const lines = R.speed as SVGGElement;
      lines.style.opacity = String(f.speed);
      if (f.speed > 0) lines.setAttribute("transform", `translate(0 ${((now / 40) % 60) - 30})`);

      const pause = R.pause as SVGGElement;
      pause.style.opacity = f.paused ? "1" : "0";
      if (f.paused) pause.setAttribute("transform", `translate(0 ${Math.sin(now / 500) * 3})`);

      const burst = R.burst as SVGGElement;
      if (f.burst > 0) {
        const b = f.burst;
        burst.style.opacity = String(1 - b);
        burst.setAttribute("transform", `translate(60 ${GROUND_Y}) scale(${0.6 + b * 1.6})`);
      } else burst.style.opacity = "0";

      if (f.thud && !director.reduced) {
        document.documentElement.classList.add("is-thud");
        window.setTimeout(() => document.documentElement.classList.remove("is-thud"), 140);
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("mousemove", onMouse);
      reducedMQ.removeEventListener?.("change", onMQ);
      ro.disconnect();
      io.disconnect();
      offLead();
    };
  }, []);

  return (
    <svg ref={svgRef} className="char" aria-hidden="true" focusable="false">
      <g ref={gRef} className="char__g" style={{ opacity: 0 }}>
        <ellipse ref={set("shadow")} className="char__shadow" cx="60" cy={GROUND_Y + 2} rx="24" ry="4" />
        <g ref={set("burst")} className="char__burst" style={{ opacity: 0 }}>
          <circle r="22" />
          {Array.from({ length: 7 }).map((_, i) => {
            const a = (i / 7) * Math.PI + Math.PI;
            return <line key={i} x1={Math.cos(a) * 30} y1={Math.sin(a) * 30} x2={Math.cos(a) * 46} y2={Math.sin(a) * 46} />;
          })}
        </g>
        <g ref={set("speed")} className="char__speed" style={{ opacity: 0 }}>
          <line x1="14" y1="-40" x2="14" y2="10" />
          <line x1="104" y1="-10" x2="104" y2="48" />
          <line x1="128" y1="-70" x2="128" y2="-20" />
          <line x1="-12" y1="40" x2="-12" y2="84" />
        </g>
        <g ref={set("pause")} className="char__pause" style={{ opacity: 0 }}>
          <rect x="47" y="-6" width="9" height="24" rx="3" />
          <rect x="64" y="-6" width="9" height="24" rx="3" />
        </g>
        <g ref={bodyRef} className="char__body">
          <polyline ref={set("legL")} className="char__far" />
          <polyline ref={set("armL")} className="char__far char__arm" />
          <line ref={set("torso")} className="char__torso" />
          <circle ref={set("head")} className="char__head" r={HEAD_R} />
          <polyline ref={set("legR")} className="char__near" />
          <polyline ref={set("armR")} className="char__near char__arm" />
        </g>
      </g>
    </svg>
  );
}
