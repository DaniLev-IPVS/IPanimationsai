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
   One hop from wall A (behind him) to wall B (ahead). He faces the direction
   of travel the whole hop; the next hop flips facing, so the "plant" pose on
   arrival and the "coil" pose at the start mirror each other with the feet
   the same distance from the hips. That keeps the feet on the wall across
   the flip.
   ─────────────────────────────────────────────────────────────────────── */

/** Coiled on the wall behind: knees deep, feet on the wall just behind the hips, torso leaning out. */
export const COIL: Pose = P({ tR: 32, kR: 118, tL: 24, kL: 112, aR: -34, eR: -36, aL: -46, eL: -30, lean: 28, head: 5, sx: 1.05, sy: 0.95 });
/** Full push: both legs driven straight back into the wall, body stretched forward, arms swinging through. */
export const PUSH: Pose = P({ tR: -42, kR: 4, tL: -34, kL: 8, aR: 34, eR: -10, aL: 10, eL: -14, lean: 40, head: 6, sx: 0.94, sy: 1.06 });
/** Flight: legs trailing and loosening, arms low and back, chest forward. */
export const FLY: Pose = P({ tR: -24, kR: 36, tL: -8, kL: 54, aR: -24, eR: -22, aL: -40, eL: -18, lean: 30, head: 5 });
/** Legs swung forward to meet the wall feet first, torso rocking back to absorb. */
export const REACH: Pose = P({ tR: 50, kR: 26, tL: 42, kL: 34, aR: 36, eR: -18, aL: 22, eL: -16, lean: -4, head: 3 });
/** Planted on the wall ahead: feet forward on it, knees folding deep (mirror of COIL). */
export const PLANT: Pose = P({ tR: 54, kR: 78, tL: 48, kL: 72, aR: 28, eR: -30, aL: 16, eL: -26, lean: -12, head: 2, sx: 1.05, sy: 0.95 });
/** Reaching up with both hands for the rim of the hole. */
export const RIM_REACH: Pose = P({ tR: 10, kR: 30, tL: -4, kL: 36, aR: 172, eR: 4, aL: 166, eL: -4, lean: 6, head: 2 });

/**
 * Pose for a wall hop at progress t ∈ [0,1]. `toRim` for the last hop that
 * ends hanging from the hole: the arms go up instead of planting.
 */
export function wallHopPose(t: number, toRim: boolean): Pose {
  if (t < 0.14) return mix(COIL, PUSH, easeOut(t / 0.14));
  if (t < 0.3) return mix(PUSH, FLY, easeInOut((t - 0.14) / 0.16));
  if (toRim) {
    if (t < 0.6) return FLY;
    return mix(FLY, RIM_REACH, easeInOut((t - 0.6) / 0.4));
  }
  if (t < 0.6) return FLY;
  if (t < 0.84) return mix(FLY, REACH, easeInOut((t - 0.6) / 0.24));
  return mix(REACH, PLANT, easeIn((t - 0.84) / 0.16));
}

/** Near-foot displacement forward of the hip column, in rig units, for the wall contact. */
export function footForward(p: Pose): number {
  const sk = solve(p);
  return Math.max(sk.footR[0], sk.footL[0]) - 60;
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
