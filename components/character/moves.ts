/**
 * The two acrobatic moves, as pure functions of time so they can be rendered
 * and inspected frame by frame outside the browser.
 *
 * Conventions follow rig.ts: angles in degrees, 0 = straight down, positive =
 * forward (towards the facing side). All positions are in local rig units
 * (feet on the ground at y = 194); the caller scales and places them.
 */

import { POSES, type Pose, mix, solve, easeIn, easeOut, easeInOut, clamp, lerp, GROUND_Y } from "./rig";

const P = (p: Partial<Pose>): Pose => ({
  tR: 0, kR: 0, tL: 0, kL: 0, aR: 0, eR: 0, aL: 0, eL: 0,
  lean: 0, head: 0, sx: 1, sy: 1, grounded: 0, ...p,
});

/* ── wall run ────────────────────────────────────────────────────────────
   One hop from wall A (behind him) to wall B (ahead), as a parkour stride:
   a lead leg and a trail leg, the opposite arm forward. On the wall he is
   scrunched with both feet planted; the push drives the lead leg straight
   first, the trail leg follows; in flight he holds a running stride; the
   lead foot reaches the next wall first and the trail leg swings in as he
   scrunches again. The lead leg alternates every hop.

   Poses below are written with the lead leg = R (near) and trail = L (far);
   `swapSides` mirrors them for the other lead. The coil at the start and the
   scrunch on arrival keep the feet at the hip column, so the feet stay on
   the wall across the facing flip between hops.
   ─────────────────────────────────────────────────────────────────────── */

/** Scrunched on the wall: both feet planted just behind the hips, lead knee a little higher, opposite arm forward. */
export const COIL: Pose = P({ tR: 38, kR: 122, tL: 26, kL: 110, aR: -42, eR: -30, aL: 32, eL: -44, lean: -26, head: 5, sx: 1.05, sy: 0.95 });
/** First push: the lead leg driven straight back into the wall, trail leg still folded, arms mid-swing. */
export const PUSH1: Pose = P({ tR: -40, kR: 4, tL: 30, kL: 108, aR: 6, eR: -14, aL: 2, eL: -20, lean: -36, head: 6, sx: 0.98, sy: 1.02 });
/** Second push: both legs straight into the wall, body stretched, arms through to the stride. */
export const PUSH2: Pose = P({ tR: -44, kR: 4, tL: -34, kL: 12, aR: 42, eR: -12, aL: -38, eL: -16, lean: -42, head: 6, sx: 0.94, sy: 1.06 });
/** Flight: a running stride. Lead knee up and forward, trail leg back, lead-side arm back, other arm forward. */
export const FLY: Pose = P({ tR: 56, kR: 96, tL: -40, kL: 62, aR: -40, eR: -28, aL: 52, eL: -52, lean: -22, head: 5 });
/** Reaching the next wall: lead leg extends out to it, trail leg starts to come through, arms forward for balance. */
export const REACH: Pose = P({ tR: 64, kR: 18, tL: -18, kL: 70, aR: 24, eR: -20, aL: 34, eL: -30, lean: -2, head: 3 });
/** First contact: lead foot on the wall and folding, trail leg swinging in. */
export const TOUCH: Pose = P({ tR: 56, kR: 84, tL: 22, kL: 62, aR: 20, eR: -32, aL: 12, eL: -30, lean: 6, head: 3, sx: 1.02, sy: 0.98 });
/** Reaching up with both hands for the rim of the hole. */
export const RIM_REACH: Pose = P({ tR: 10, kR: 30, tL: -4, kL: 36, aR: 172, eR: 4, aL: 166, eL: -4, lean: -4, head: 2 });

/** Mirror a pose's sides: the far leg/arm become the near ones. */
export function swapSides(p: Pose): Pose {
  return { ...p, tR: p.tL, kR: p.kL, tL: p.tR, kL: p.kR, aR: p.aL, eR: p.eL, aL: p.aR, eL: p.eR };
}
/** Mirror a pose front-to-back in its own space: what was behind is now ahead. */
export function mirrorFrontBack(p: Pose): Pose {
  return { ...p, tR: -p.tR, tL: -p.tL, aR: -p.aR, aL: -p.aL, lean: -p.lean, head: -p.head };
}

export type Lead = "R" | "L";

/**
 * Pose for a wall hop at progress t ∈ [0,1] with the given lead leg.
 * `toRim` for the last hop that ends hanging from the hole.
 */
export function wallHopPose(t: number, toRim: boolean, lead: Lead = "R"): Pose {
  const sw = lead === "L";
  const S = (p: Pose) => (sw ? swapSides(p) : p);
  const coil = S(COIL), push1 = S(PUSH1), push2 = S(PUSH2), fly = S(FLY), reach = S(REACH), touch = S(TOUCH);
  // On arrival he scrunches against the wall ahead with the other leg set to
  // lead: the next hop's coil, seen from this side (so feet ahead, on wall B).
  const plant = mirrorFrontBack(sw ? COIL : swapSides(COIL));
  if (t < 0.08) return coil;
  if (t < 0.16) return mix(coil, push1, easeIn((t - 0.08) / 0.08));
  if (t < 0.24) return mix(push1, push2, (t - 0.16) / 0.08);
  if (t < 0.4) return mix(push2, fly, easeOut((t - 0.24) / 0.16));
  if (toRim) {
    if (t < 0.6) return fly;
    return mix(fly, RIM_REACH, easeInOut((t - 0.6) / 0.4));
  }
  if (t < 0.6) return fly;
  if (t < 0.8) return mix(fly, reach, easeInOut((t - 0.6) / 0.2));
  if (t < 0.9) return mix(reach, touch, easeIn((t - 0.8) / 0.1));
  return mix(touch, plant, easeOut((t - 0.9) / 0.1));
}

/**
 * The first hop of the climb: from the ground up to the first wall. A real
 * take-off (crouch, jump, running stride) rather than a wall push, then the
 * same reach, touch and plant as a wall hop.
 */
export function takeoffPose(t: number, lead: Lead = "R"): Pose {
  const sw = lead === "L";
  const S = (p: Pose) => (sw ? swapSides(p) : p);
  const fly = S(FLY);
  if (t < 0.12) return mix(POSES.idle, POSES.crouch, easeInOut(t / 0.12));
  if (t < 0.26) return mix(POSES.crouch, S(POSES.leap), easeOut((t - 0.12) / 0.14));
  if (t < 0.45) return mix(S(POSES.leap), fly, easeInOut((t - 0.26) / 0.19));
  return wallHopPose(t, false, lead);
}

/** The scrunch on the wall for a given lead: where he waits if the scroll stops mid-push. */
export function coilPose(lead: Lead): Pose {
  return lead === "L" ? swapSides(COIL) : COIL;
}

/** Forward displacement (rig units) of the foot that is on the wall: the rearmost foot while pushing, the foremost while landing. */
export function contactFoot(p: Pose, phase: "push" | "land"): number {
  const sk = solve(p);
  const r = sk.footR[0] - 60, l = sk.footL[0] - 60;
  return phase === "push" ? Math.min(r, l) : Math.max(r, l);
}
export function footForward(p: Pose): number {
  return contactFoot(p, "land");
}
/** The stance he arrives in, with the given lead for the hop just flown. */
export function plantPose(lead: Lead): Pose {
  return mirrorFrontBack(lead === "L" ? COIL : swapSides(COIL));
}

/* ── muscle-up ───────────────────────────────────────────────────────────
   Facing the hole, hands on the rim at the hole's corner. The hands never
   move: every phase's body position is derived from where the hands are in
   the pose, so the pull and the press read as real.
   ─────────────────────────────────────────────────────────────────────── */

export const HANG: Pose = P({ tR: 6, kR: 8, tL: -4, kL: 10, aR: 178, eR: 0, aL: 176, eL: 0, lean: 0, head: 0 });
/** Chin over the rim: upper arms down and forward, elbows bent hard, knees tucking. */
export const PULL: Pose = P({ tR: 30, kR: 56, tL: 18, kL: 48, aR: 58, eR: 102, aL: 54, eL: 100, lean: 8, head: 5 });
/** Pressed out on straight arms, hips at the rim, legs hanging. */
export const PRESS: Pose = P({ tR: 14, kR: 16, tL: 4, kL: 14, aR: 18, eR: 2, aL: 14, eL: 2, lean: 14, head: 6 });
/** Mantle: the near foot swung up onto the ledge beside the hands, leaning forward over it. */
export const MANTLE: Pose = P({ tR: 110, kR: 95, tL: 8, kL: 10, aR: 10, eR: 0, aL: 6, eL: 0, lean: 30, head: 8 });

export type MuscleFrame = {
  pose: Pose;
  /** Hand position in local units: pinned to the rim while `anchor` is "hand". */
  hand: [number, number];
  /** Near-foot position in local units: pinned to the ledge while `anchor` is "foot". */
  foot: [number, number];
  /** What is bearing his weight. */
  anchor: "hand" | "foot";
  done: boolean;
};

/**
 * Muscle-up at time t (ms). He faces away from the hole: the ledge he is
 * climbing onto is in front of him, the shaft behind. Hands on the corner
 * carry him through the hang, pull and press; from the middle of the mantle
 * the near foot is on the ledge and carries him instead.
 */
export function muscleUpFrame(t: number): MuscleFrame {
  const HANG_MS = 900, PULL_MS = 520, PRESS_MS = 420, MANTLE_MS = 620, STAND_MS = 420;
  let pose: Pose;
  let anchor: "hand" | "foot" = "hand";
  if (t < HANG_MS) {
    const sw = Math.sin(t / 150) * 10 * Math.exp(-t / 1100);
    pose = { ...HANG, lean: sw, tR: HANG.tR + sw * 0.8, tL: HANG.tL + sw * 0.8 };
  } else if (t < HANG_MS + PULL_MS) {
    pose = mix(HANG, PULL, easeInOut((t - HANG_MS) / PULL_MS));
  } else if (t < HANG_MS + PULL_MS + PRESS_MS) {
    pose = mix(PULL, PRESS, easeInOut((t - HANG_MS - PULL_MS) / PRESS_MS));
  } else if (t < HANG_MS + PULL_MS + PRESS_MS + MANTLE_MS) {
    const u = easeInOut((t - HANG_MS - PULL_MS - PRESS_MS) / MANTLE_MS);
    pose = mix(PRESS, MANTLE, u);
    anchor = u > 0.6 ? "foot" : "hand";
  } else if (t < HANG_MS + PULL_MS + PRESS_MS + MANTLE_MS + STAND_MS) {
    const u = easeOut((t - HANG_MS - PULL_MS - PRESS_MS - MANTLE_MS) / STAND_MS);
    pose = mix(MANTLE, POSES.crouch, u);
    anchor = "foot";
  } else {
    return { pose: POSES.crouch, hand: [60, 194], foot: [60, 194], anchor: "foot", done: true };
  }
  const sk = solve(pose);
  return { pose, hand: sk.handR, foot: sk.footR, anchor, done: false };
}

export const MUSCLE_STAND_START = 900 + 520 + 420 + 620;

export { clamp, lerp, GROUND_Y };
