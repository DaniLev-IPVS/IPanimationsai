/**
 * The stick figure's skeleton.
 *
 * Local units: a 120×200 box. Head centre (60,42) r15, shoulder (60,66),
 * hip (60,112), thigh 40, shin 42, upper arm 28, forearm 28. Standing feet
 * land on y=194. Angles are degrees from straight-down, positive = forward
 * (towards +x, the facing direction). Facing left is a horizontal flip.
 */

export type Pose = {
  tR: number; kR: number; // near leg: thigh angle, knee bend (shin = thigh − knee)
  tL: number; kL: number; // far leg
  aR: number; eR: number; // near arm: shoulder angle, elbow (forearm = a + e)
  aL: number; eL: number; // far arm
  lean: number;           // whole body rotation about the hip, + = forward
  head: number;           // head centre x offset (nod / look)
  sx: number; sy: number; // squash & stretch about the anchor
  grounded: number;       // 1 → feet pinned to the ground line
};

export const HEAD: [number, number] = [60, 42];
export const HEAD_R = 15;
export const SHOULDER: [number, number] = [60, 66];
export const HIP: [number, number] = [60, 112];
export const GROUND_Y = 194;
const THIGH = 40, SHIN = 42, UPPER = 28, FORE = 28;

const P = (p: Partial<Pose>): Pose => ({
  tR: 0, kR: 0, tL: 0, kL: 0, aR: 0, eR: 0, aL: 0, eL: 0,
  lean: 0, head: 0, sx: 1, sy: 1, grounded: 1, ...p,
});

export const POSES = {
  idle:     P({ tR: 4, kR: 4, tL: -4, kL: 4, aR: 8, eR: -16, aL: -8, eL: -16 }),
  look:     P({ tR: 4, kR: 4, tL: -4, kL: 4, aR: 8, eR: -16, aL: -8, eL: -16, head: 6, lean: 4 }),
  crouch:   P({ tR: 60, kR: 110, tL: 50, kL: 105, aR: -45, eR: -25, aL: -55, eL: -25, lean: 28, head: 4, sx: 1.08, sy: 0.9 }),
  leap:     P({ tR: 30, kR: 50, tL: -15, kL: 35, aR: 160, eR: 12, aL: 150, eL: 10, lean: -6, sx: 0.94, sy: 1.08, grounded: 0 }),
  fall:     P({ tR: 28, kR: 22, tL: -22, kL: 28, aR: 135, eR: 18, aL: 160, eL: 10, lean: 12, grounded: 0 }),
  flail:    P({ tR: 50, kR: 65, tL: -40, kL: 55, aR: 168, eR: -35, aL: 178, eL: 32, lean: 24, head: 3, grounded: 0 }),
  brace:    P({ tR: 18, kR: 32, tL: -12, kL: 26, aR: -55, eR: -20, aL: -65, eL: -20, lean: 10, grounded: 0 }),
  heroLand: P({ tR: 92, kR: 132, tL: -28, kL: 100, aR: -52, eR: 0, aL: -125, eL: -30, lean: 52, head: 10, sx: 1.1, sy: 0.9 }),
  rise:     P({ tR: 30, kR: 50, tL: -10, kL: 30, aR: -20, eR: -20, aL: -30, eL: -20, lean: 18, head: 2 }),
  brushL:   P({ tR: 4, kR: 4, tL: -4, kL: 4, aR: 62, eR: -128, aL: -10, eL: -14, head: -2 }),
  brushR:   P({ tR: 4, kR: 4, tL: -4, kL: 4, aR: 48, eR: -118, aL: -12, eL: -14, head: 2 }),
  point:    P({ tR: 6, kR: 4, tL: -6, kL: 4, aR: 84, eR: 2, aL: -10, eL: -16, head: 3, lean: 3 }),
  /** Pointing up and forward, at the form above him. */
  pointUp:  P({ tR: 6, kR: 4, tL: -6, kL: 4, aR: 126, eR: 4, aL: -8, eL: -16, head: 5, lean: 4 }),
  reach:    P({ tR: 8, kR: 6, tL: -6, kL: 4, aR: 96, eR: -4, aL: -14, eL: -14, lean: 8, head: 4 }),
  cheer:    P({ tR: 20, kR: 30, tL: -20, kL: 30, aR: 165, eR: 20, aL: 160, eL: -20, lean: -4, sx: 0.96, sy: 1.05, grounded: 0 }),
  hang:     P({ tR: 10, kR: 10, tL: -10, kL: 10, aR: 120, eR: 30, aL: 150, eL: 20, lean: 6, grounded: 0 }),
  /** Head-first into the hole: body tipped forward, legs together, arms along the body. */
  dive:     P({ tR: 6, kR: 6, tL: -4, kL: 6, aR: 168, eR: 6, aL: 174, eL: -6, lean: 62, head: 6, sx: 0.92, sy: 1.1, grounded: 0 }),
  /** Feet on a wall behind him, coiled, about to push off forward. */
  kick:     P({ tR: -55, kR: 110, tL: -70, kL: 120, aR: 40, eR: -40, aL: -30, eL: -30, lean: -18, head: 3, sx: 1.06, sy: 0.94, grounded: 0 }),
} satisfies Record<string, Pose>;

export type PoseName = keyof typeof POSES;

/** The honest 8-frame walk from the old WalkCycle, now interpolated. */
export const WALK: Pose[] = [
  { tR:  25, kR:  2, tL: -25, kL: 16, aR: -26, aL:  26 },
  { tR:  10, kR: 18, tL: -32, kL: 26, aR: -16, aL:  16 },
  { tR:  -5, kR:  8, tL: -10, kL: 56, aR:  -5, aL:   5 },
  { tR: -18, kR:  3, tL:  12, kL: 36, aR:   9, aL:  -9 },
  { tR: -25, kR: 16, tL:  25, kL:  2, aR:  26, aL: -26 },
  { tR: -32, kR: 26, tL:  10, kL: 18, aR:  16, aL: -16 },
  { tR: -10, kR: 56, tL:  -5, kL:  8, aR:   5, aL:  -5 },
  { tR:  12, kR: 36, tL: -18, kL:  3, aR:  -9, aL:   9 },
].map((f) => P({ ...f, eR: -22, eL: -22 }));

/** Walk pose at phase φ∈[0,1), blended between frames. */
export function walkPose(phase: number): Pose {
  const n = WALK.length;
  const f = ((phase % 1) + 1) % 1 * n;
  const i = Math.floor(f);
  return mix(WALK[i], WALK[(i + 1) % n], f - i);
}

export function mix(a: Pose, b: Pose, t: number): Pose {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const o = {} as Pose;
  (Object.keys(a) as (keyof Pose)[]).forEach((k) => {
    o[k] = a[k] + (b[k] - a[k]) * t;
  });
  return o;
}

export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t: number) => t * t * t;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Pt = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const tip = ([x, y]: Pt, deg: number, len: number): Pt => [x + len * Math.sin(rad(deg)), y + len * Math.cos(rad(deg))];
const rot = ([x, y]: Pt, [cx, cy]: Pt, deg: number): Pt => {
  const r = rad(deg), c = Math.cos(r), s = Math.sin(r);
  const dx = x - cx, dy = y - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
};

export type Skeleton = {
  head: Pt; shoulder: Pt; hip: Pt;
  kneeR: Pt; footR: Pt; kneeL: Pt; footL: Pt;
  elbowR: Pt; handR: Pt; elbowL: Pt; handL: Pt;
  /** y offset applied so grounded poses keep their feet on GROUND_Y. */
  drop: number;
};

/** Solve joint positions for a pose, in local units (unflipped, unscaled). */
export function solve(p: Pose): Skeleton {
  const kneeR = tip(HIP, p.tR, THIGH);
  const footR = tip(kneeR, p.tR - p.kR, SHIN);
  const kneeL = tip(HIP, p.tL, THIGH);
  const footL = tip(kneeL, p.tL - p.kL, SHIN);
  const elbowR = tip(SHOULDER, p.aR, UPPER);
  const handR = tip(elbowR, p.aR + p.eR, FORE);
  const elbowL = tip(SHOULDER, p.aL, UPPER);
  const handL = tip(elbowL, p.aL + p.eL, FORE);
  const head: Pt = [HEAD[0] + p.head, HEAD[1]];

  // Lean: rotate everything about the hip. Positive = tip forward (clockwise on screen
  // for a right-facing figure).
  const pts: Record<string, Pt> = { head, shoulder: SHOULDER, hip: HIP, kneeR, footR, kneeL, footL, elbowR, handR, elbowL, handL };
  if (p.lean) for (const k in pts) pts[k] = rot(pts[k], HIP, -p.lean);

  // Grounded poses keep their lowest contact on the ground line.
  const lowest = Math.max(pts.footR[1], pts.footL[1], pts.kneeR[1], pts.kneeL[1]);
  const drop = (GROUND_Y - lowest) * p.grounded;
  if (drop) for (const k in pts) pts[k] = [pts[k][0], pts[k][1] + drop];

  return { ...(pts as Omit<Skeleton, "drop">), drop };
}
