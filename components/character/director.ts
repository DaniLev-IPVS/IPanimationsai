/**
 * The director decides, every frame, where the character is and what he is
 * doing, from scroll position, scroll velocity and direction, and a one-off
 * set of page measurements. It is pure arithmetic over refs: no React, no DOM
 * writes. Character.tsx renders whatever it returns.
 *
 * Scroll-down story: idle by the screen → jump into the hole → fall pinned
 * near the middle of the viewport while the page streams past → brace → land
 * like a superhero on the footer ground → stand, brush off, idle.
 * Scroll-up story: leave the fall lane and jump platform to platform
 * (card tops, headings, the ticker) back to the hero ground.
 */

import { POSES, type Pose, mix, walkPose, clamp, lerp, easeInOut, easeOut, easeIn } from "./rig";

/** Somewhere he can stand: document y of the surface, viewport x of his feet. */
export type Platform = { docY: number; x: number };

export type Layout = {
  vw: number;
  vh: number;
  maxScroll: number;      // document height − viewport height
  scale: number;
  behind: boolean;        // layer sits behind content (no gutter to fall down)
  laneX: number;          // viewport x of the fall lane
  standX: number;         // where he idles by the hole
  leftX: number;          // where he stands pointing at the form
  holeX: number;
  heroGround: number;     // document y of the ground line once the stage has released
  stageStart: number;     // scroll at which the hero stage pins
  stageEnd: number;       // scroll at which it releases
  footerGround: number;   // document y
  footerX: number;        // where he lands
  workTop: number;        // document y where the page turns Charcoal
  /**
   * The climb: a chain of real elements he jumps between on the way up,
   * bottom → top, starting on the footer ground and ending at his spot by
   * the hole. Built by Character.tsx from the page's cards, text and images.
   */
  footholds: Platform[];
};

export type Frame = {
  x: number; y: number;       // viewport anchor (feet when standing)
  face: 1 | -1;
  pose: Pose;
  opacity: number;
  speed: number;              // 0..1 for speed lines
  dark: boolean;              // paper lines (on Charcoal) vs ink
  burst: number;              // 0..1 landing burst progress, 0 = none
  shadow: number;             // 0..1 ground shadow strength
  thud: boolean;              // true on the impact frame only
  zFront: boolean;            // layer in front of content
  paused: boolean;            // hovering mid-air because scrolling stopped
  /** Standing on the measured ground line (real viewport y): skip the scroll-smoothing shift. */
  attached?: boolean;
};

type Mode = "down" | "up";
type Intro = "waiting" | "walk" | "done";

const BLEND_MS = 260;

export class Director {
  layout: Layout | null = null;
  reduced = false;
  lowPower = false;

  private mode: Mode = "down";
  private intro: Intro = "waiting";
  private introT0 = 0;
  private screenOn = false;
  private lastScroll = 0;
  private vel = 0;              // px/s, signed, smoothed
  private lastNow = 0;
  private landedAt = 0;         // time of impact, 0 = not landed
  private wasAbove = true;      // were we above the landing point last frame
  private celebrateT0 = 0;
  private blendFrom: Frame | null = null;
  private blendT0 = 0;
  private walkPhase = 0;
  private face: 1 | -1 = 1;
  private mouse = { x: 0, y: 0, has: false };
  private lastFrame: Frame | null = null;
  private climbFace: 1 | -1 = 1;
  private lastMoveAt = 0;
  private walkFrom = 0;
  private lastX = NaN;
  private groundY = 0;
  private submitX = NaN;
  /** The hop-and-point at the Submit button: start time, 0 = not playing. */
  private gestureT0 = 0;
  private gestureEnd = 0;
  /** Scroll position he actually follows: the real one, low-passed so wheel steps read as motion. */
  private s = NaN;

  /** Called by the component when the screen switch should fire. */
  onScreenOn: () => void = () => {};

  startIntro(now: number) {
    if (this.intro !== "waiting") return;
    if (this.reduced) {
      this.intro = "done";
      this.fireScreen();
      return;
    }
    this.intro = "walk";
    this.introT0 = now;
  }

  celebrate(now: number) {
    this.celebrateT0 = now;
  }

  setMouse(x: number, y: number) {
    this.mouse = { x, y, has: true };
  }

  private fireScreen() {
    if (this.screenOn) return;
    this.screenOn = true;
    this.onScreenOn();
  }

  private key() {
    const L = this.layout!;
    // Where his feet hang while falling, measured from the top of the viewport.
    const pinY = clamp(L.vh * 0.42, 150, L.vh * 0.6) + 70 * L.scale;
    const sPin = L.heroGround - pinY;
    const jumpLen = clamp(L.vh * 0.34, 150, 380);
    const sJumpStart = sPin - jumpLen;
    // He lands when the footer ground reaches the pin line, or when the page
    // runs out of scroll, whichever comes first (the footer is short, so it is
    // almost always the latter: he drops the last stretch to meet the ground).
    const sLand = Math.min(L.footerGround - pinY, L.maxScroll - 4);
    const landLen = clamp(L.vh * 0.32, 140, 360);
    const sLandStart = Math.max(sLand - landLen, sPin + 1);
    // Climbing maps scroll to a document "pin" so that the footer ground is
    // exactly at the landing scroll and the hero ground is reached before the
    // jump-in zone.
    const climbOffset = L.footerGround - sLand;
    return { pinY, sPin, jumpLen, sJumpStart, sLand, landLen, sLandStart, climbOffset };
  }

  update(now: number, realScroll: number, groundY: number, submitX: number): Frame | null {
    const L = this.layout;
    if (!L) return null;
    this.groundY = groundY;
    this.submitX = submitX;
    const dt = this.lastNow ? Math.min(0.05, (now - this.lastNow) / 1000) : 1 / 60;
    this.lastNow = now;

    // Follow the real scroll through a short low-pass so a mouse wheel's
    // discrete steps become continuous motion. Everything below works in the
    // smoothed value; the final frame is shifted back so anything attached to
    // the page (the ground lines) stays pixel-exact.
    if (Number.isNaN(this.s)) this.s = realScroll;
    this.s += (realScroll - this.s) * (1 - Math.exp(-dt * 13));
    if (Math.abs(realScroll - this.s) < 0.25) this.s = realScroll;
    const scrollY = this.s;

    // Velocity, smoothed. Direction flips only past a small threshold so a
    // trackpad jitter doesn't flip him mid-air.
    const raw = dt > 0 ? (realScroll - this.lastScroll) / dt : 0;
    this.lastScroll = realScroll;
    this.vel = lerp(this.vel, raw, 1 - Math.exp(-dt * 12));
    if (Math.abs(raw) > 20) this.lastMoveAt = now;
    const K = this.key();
    const inMid = scrollY > K.sJumpStart && scrollY <= K.sLand + 2;
    let nextMode: Mode = this.mode;
    if (this.vel > 180) nextMode = "down";
    else if (this.vel < -180) nextMode = "up";
    if (nextMode !== this.mode && inMid && this.lastFrame && !this.reduced) {
      this.blendFrom = this.lastFrame;
      this.blendT0 = now;
    }
    this.mode = nextMode;

    // Intro cut short by scrolling.
    if (this.intro !== "done" && this.intro !== "waiting" && scrollY > K.sJumpStart) {
      this.intro = "done";
      this.fireScreen();
    }
    if (scrollY > K.sJumpStart && !this.screenOn) this.fireScreen();

    // Impact detection: crossed the landing point going down. Decided before
    // the pose so the very first frame on the ground is already the landing.
    const above = scrollY < K.sLand;
    let thud = false;
    if (this.wasAbove && !above && this.mode === "down" && !this.reduced) {
      this.landedAt = now;
      thud = true;
    }
    if (above && scrollY < K.sLandStart) this.landedAt = 0;
    this.wasAbove = above;

    let f: Frame;
    if (this.reduced) f = this.reducedFrame(scrollY, K);
    else if (this.intro !== "done" && this.intro !== "waiting") f = this.introFrame(now, scrollY, dt);
    else if (scrollY <= K.sJumpStart) f = this.heroIdle(now, scrollY, dt);
    else if (this.mode === "up") f = this.climbFrame(now, scrollY, K);
    else if (scrollY <= K.sPin) f = this.jumpIn(scrollY, K);
    else if (scrollY < K.sLandStart) f = this.fallFrame(now, scrollY, K);
    else if (scrollY < K.sLand) f = this.landApproach(scrollY, K);
    else f = this.bottomFrame(now, scrollY, K);


    // Celebration overrides a grounded pose for 1.4s.
    if (this.celebrateT0 && now - this.celebrateT0 < 1400 && f.pose.grounded > 0.5) {
      const t = (now - this.celebrateT0) / 1400;
      const hop = Math.abs(Math.sin(t * Math.PI * 3)) * 26 * L.scale;
      f = { ...f, y: f.y - hop, pose: mix(f.pose, POSES.cheer, clamp(Math.sin(t * Math.PI) * 1.4, 0, 1)) };
    }

    // Direction-switch blend.
    if (this.blendFrom && now - this.blendT0 < BLEND_MS) {
      const t = easeInOut((now - this.blendT0) / BLEND_MS);
      f = { ...f, x: lerp(this.blendFrom.x, f.x, t), y: lerp(this.blendFrom.y, f.y, t), pose: mix(this.blendFrom.pose, f.pose, t) };
    } else this.blendFrom = null;

    // Back to real-scroll viewport space (not for frames standing on the measured ground).
    if (!f.attached) f = { ...f, y: f.y + (scrollY - realScroll) };
    f.dark = realScroll + f.y > L.workTop;
    f.zFront = !L.behind;
    const airborne = scrollY > K.sPin && scrollY < K.sLand && this.intro === "done" && !this.reduced;
    f.paused = airborne && now - this.lastMoveAt > 450 && !f.thud;
    this.lastFrame = f;
    return f;
  }

  private base(x: number, y: number, pose: Pose): Frame {
    return { x, y, face: this.face, pose, opacity: 1, speed: 0, dark: false, burst: 0, shadow: pose.grounded, thud: false, zFront: true, paused: false };
  }

  /* ── hero ─────────────────────────────────────────────────────────── */

  private stageP(scrollY: number) {
    const L = this.layout!;
    return clamp((scrollY - L.stageStart) / Math.max(1, L.stageEnd - L.stageStart), 0, 1);
  }

  private introFrame(now: number, scrollY: number, dt: number): Frame {
    const L = this.layout!;
    const gy = this.groundY;
    // Landed mid-stage? Skip the walk-in.
    if (this.stageP(scrollY) > 0.25) { this.intro = "done"; return this.heroIdle(now, scrollY, dt); }
    const t = now - this.introT0;
    const from = -40 * L.scale;
    const ms = clamp(((L.leftX - from) / 300) * 1000, 400, 1200);
    const q = clamp(t / ms, 0, 1);
    this.face = 1;
    this.walkPhase += dt * 2.1;
    const x = lerp(from, L.leftX, q < 0.9 ? (q / 0.9) * 0.97 : 0.97 + easeOut((q - 0.9) / 0.1) * 0.03);
    let pose = walkPose(this.walkPhase);
    if (q > 0.92) pose = mix(pose, POSES.pointUp, (q - 0.92) / 0.08);
    const f = this.base(x, gy, pose);
    f.attached = true;
    f.opacity = clamp(q * 6, 0, 1);
    if (q >= 1) { this.intro = "done"; this.lastX = L.leftX; this.gestureT0 = now; }
    return f;
  }

  /**
   * Hop, land, point at the Submit button. Returns the pose and how far off
   * the ground he is at time t (ms since the gesture started). Holds the
   * point after it finishes.
   */
  private gesture(t: number, breathe: number): { pose: Pose; lift: number } {
    const L = this.layout!;
    if (t < 220) return { pose: mix(POSES.idle, POSES.crouch, easeInOut(t / 220)), lift: 0 };
    if (t < 540) {
      const u = (t - 220) / 320;
      return { pose: mix(POSES.crouch, POSES.leap, easeOut(Math.min(1, u * 2))), lift: Math.sin(u * Math.PI) * 44 * L.scale };
    }
    if (t < 700) return { pose: mix(POSES.leap, POSES.crouch, easeInOut((t - 540) / 160)), lift: 0 };
    if (t < 980) return { pose: mix(POSES.crouch, POSES.pointUp, easeOut((t - 700) / 280)), lift: 0 };
    return { pose: mix(POSES.pointUp, POSES.look, breathe * 0.12), lift: 0 };
  }

  private faceSubmit(x: number) {
    if (!Number.isNaN(this.submitX)) this.face = this.submitX >= x ? 1 : -1;
  }

  private heroIdle(now: number, scrollY: number, dt: number): Frame {
    const L = this.layout!;
    const gy = this.groundY;
    const p = this.stageP(scrollY);
    const breathe = Math.sin(now / 900) * 0.5 + 0.5;
    const stillFor = now - this.lastMoveAt;
    let x: number;
    let pose: Pose;
    let lift = 0;

    if (p < 0.3) {
      // By the form: hop and point at Submit, again every few seconds.
      x = L.leftX;
      if (!this.gestureT0 || (now - this.gestureT0 > 3600 && stillFor > 400)) this.gestureT0 = now;
      const g = this.gesture(now - this.gestureT0, breathe);
      pose = g.pose;
      lift = g.lift;
      this.faceSubmit(x);
      if (this.mouse.has && !this.lowPower && now - this.gestureT0 > 980) {
        const dx = clamp((this.mouse.x - x) / L.vw, -1, 1);
        pose = { ...pose, head: pose.head + dx * 5 };
      }
    } else if (p < 0.9) {
      // Walking across as the phone takes the screen. Pause the scroll and he
      // stops, hops, and points back at the Submit button.
      const t = easeInOut((p - 0.3) / 0.6);
      x = lerp(L.leftX, L.standX, t);
      const dx = Number.isNaN(this.lastX) ? 0 : x - this.lastX;
      const moving = Math.abs(dx) > 0.2;
      if (moving) {
        this.walkPhase += Math.abs(dx) / (34 * L.scale);
        this.face = dx > 0 ? 1 : -1;
        this.gestureT0 = 0;
        const amt = clamp(Math.abs(dx) / (1.5 * L.scale), 0, 1);
        pose = mix(POSES.idle, walkPose(this.walkPhase), amt);
      } else if (stillFor > 550) {
        if (!this.gestureT0) this.gestureT0 = now;
        const g = this.gesture(now - this.gestureT0, breathe);
        pose = g.pose;
        lift = g.lift;
        this.faceSubmit(x);
      } else {
        pose = mix(walkPose(this.walkPhase), POSES.idle, clamp(stillFor / 250, 0, 1));
      }
      if (t > 0.97) pose = mix(pose, POSES.idle, (t - 0.97) / 0.03);
    } else {
      // By the hole, facing back at the page.
      x = L.standX;
      this.face = -1;
      this.gestureT0 = 0;
      pose = mix(POSES.idle, POSES.look, breathe * 0.25);
      if (this.mouse.has && !this.lowPower) {
        const dx = clamp((this.mouse.x - x) / L.vw, -1, 1);
        this.face = dx > 0.04 ? 1 : -1;
        pose = { ...pose, head: pose.head + Math.abs(dx) * 7, lean: pose.lean + Math.abs(dx) * 3 };
      }
    }
    this.lastX = x;
    const f = this.base(x, gy - lift, pose);
    f.attached = true;
    f.shadow = lift > 0 ? clamp(1 - lift / (40 * L.scale), 0.2, 1) : pose.grounded;
    if (this.intro === "waiting") f.opacity = 0;
    void dt;
    return f;
  }

  private jumpIn(scrollY: number, K: ReturnType<Director["key"]>): Frame {
    const L = this.layout!;
    const q = clamp((scrollY - K.sJumpStart) / K.jumpLen, 0, 1);
    const gy = this.groundY;
    this.face = 1;
    const arcH = clamp(L.vh * 0.085, 36, 74);

    // Anticipation (0–0.22): sink into a crouch. Launch (0.22–0.4): spring
    // into a stretched leap. Flight (0.4–1): arc over to the hole, tipping
    // forward into a head-first dive that carries straight into the fall.
    let pose: Pose;
    if (q < 0.22) pose = mix(POSES.idle, POSES.crouch, easeInOut(q / 0.22));
    else if (q < 0.4) pose = mix(POSES.crouch, POSES.leap, easeOut((q - 0.22) / 0.18));
    else pose = mix(POSES.leap, POSES.dive, easeInOut((q - 0.4) / 0.6));

    const travel = q < 0.22 ? 0 : easeInOut((q - 0.22) / 0.78);
    const x = lerp(L.standX, L.holeX, travel);
    const y = gy - Math.sin(travel * Math.PI) * arcH;
    const f = this.base(x, y, pose);
    f.attached = true;
    f.shadow = q < 0.22 ? 1 : clamp(1 - travel * 2, 0, 1);
    return f;
  }

  /* ── the fall ─────────────────────────────────────────────────────── */

  private fallFrame(now: number, scrollY: number, K: ReturnType<Director["key"]>): Frame {
    const L = this.layout!;
    const v = Math.abs(this.vel);
    const x = L.laneX;
    const flail = clamp((v - 350) / 1600, 0, 1);
    const still = clamp(1 - v / 200, 0, 1);
    let pose = mix(POSES.fall, POSES.flail, easeOut(flail));
    pose = mix(pose, POSES.hang, still);
    if (!this.lowPower) {
      const w = now / 1000;
      const amp = 4 + flail * 14 + still * 3;
      pose = {
        ...pose,
        aR: pose.aR + Math.sin(w * 7.3) * amp,
        aL: pose.aL + Math.cos(w * 6.1) * amp,
        tR: pose.tR + Math.sin(w * 5.2) * amp * 0.6,
        tL: pose.tL + Math.cos(w * 4.4) * amp * 0.6,
        lean: pose.lean + Math.sin(w * 1.7) * (3 + still * 5),
      };
    }
    this.face = 1;
    const sway = still ? Math.sin(now / 1100) * 6 * still : 0;
    const bob = still ? Math.sin(now / 700) * 5 * still : 0;
    const f = this.base(x + sway, K.pinY + 70 * L.scale + bob, pose);
    void K;
    f.speed = this.lowPower ? 0 : flail;
    f.shadow = 0;
    return f;
  }

  private landApproach(scrollY: number, K: ReturnType<Director["key"]>): Frame {
    const L = this.layout!;
    const q = clamp((scrollY - K.sLandStart) / K.landLen, 0, 1);
    const groundY = L.footerGround - scrollY;
    // Ease-in: he hangs, then the ground comes up fast.
    const y = lerp(K.pinY, groundY, easeIn(q));
    const x = lerp(L.laneX, L.footerX, easeInOut(q));
    const pose = mix(POSES.fall, POSES.brace, easeInOut(clamp(q / 0.7, 0, 1)));
    this.face = 1;
    const f = this.base(x, y, pose);
    f.shadow = clamp((q - 0.4) / 0.6, 0, 1) * 0.9;
    f.speed = clamp(0.5 - q * 0.5, 0, 1);
    return f;
  }

  private bottomFrame(now: number, scrollY: number, K: ReturnType<Director["key"]>): Frame {
    const L = this.layout!;
    const gy = L.footerGround - scrollY;
    const since = this.landedAt ? now - this.landedAt : 99999;
    let pose: Pose;
    let burst = 0;
    const HOLD = 1000;
    if (since < HOLD) {
      // Impact: a damped squash spring about the feet, then hold the pose
      // dead still. The dust burst runs over the first 600ms.
      const t = since / 1000;
      const k = 0.3 * Math.exp(-t * 11) * Math.cos(t * 30);
      pose = { ...POSES.heroLand, sx: POSES.heroLand.sx * (1 + k), sy: POSES.heroLand.sy * (1 - k) };
      burst = clamp(since / 600, 0, 1);
    } else if (since < HOLD + 650) {
      // Head comes up first, then the body.
      const t = easeInOut((since - HOLD) / 650);
      pose = mix(POSES.heroLand, POSES.rise, t);
      pose = { ...pose, head: lerp(POSES.heroLand.head, 0, Math.min(1, t * 1.8)) };
    } else if (since < HOLD + 1050) pose = mix(POSES.rise, POSES.idle, easeOut((since - HOLD - 650) / 400));
    else if (since < HOLD + 1450) pose = mix(POSES.idle, POSES.brushL, Math.sin(((since - HOLD - 1050) / 400) * Math.PI));
    else if (since < HOLD + 1850) pose = mix(POSES.idle, POSES.brushR, Math.sin(((since - HOLD - 1450) / 400) * Math.PI));
    else {
      // Idle, with a point at the footer CTA every few seconds.
      const cyc = ((now / 1000) % 6) / 6;
      const pt = cyc > 0.7 ? Math.sin(((cyc - 0.7) / 0.3) * Math.PI) : 0;
      pose = mix(mix(POSES.idle, POSES.look, (Math.sin(now / 900) * 0.5 + 0.5) * 0.25), POSES.point, pt);
    }
    this.face = 1;
    const f = this.base(L.footerX, gy, pose);
    f.burst = burst > 0 && burst < 1 ? burst : 0;
    f.speed = 0;
    void K;
    return f;
  }

  /* ── the climb: a few big leaps between real elements ──────────────── */

  private climbFrame(now: number, scrollY: number, K: ReturnType<Director["key"]>): Frame {
    const L = this.layout!;
    // His pin eases from where he landed up to the fall line over the first
    // half-viewport of upward scroll, so he climbs up the screen rather than
    // hugging the bottom edge all the way.
    const ease = clamp((K.sLand - scrollY) / (L.vh * 0.5), 0, 1);
    const pin = lerp(K.climbOffset, K.pinY, easeInOut(ease));
    const P = clamp(scrollY + pin, L.heroGround, L.footerGround); // feet, document y

    const chain = L.footholds; // bottom → top
    let lower = chain[0], upper = chain[chain.length - 1];
    for (let i = 0; i < chain.length - 1; i++) {
      if (chain[i].docY >= P && chain[i + 1].docY <= P) { lower = chain[i]; upper = chain[i + 1]; break; }
    }
    const hop = Math.max(1, lower.docY - upper.docY);
    const t = clamp((lower.docY - P) / hop, 0, 1);
    const arcH = clamp(hop * 0.3, 40 * L.scale, L.vh * 0.4);
    const docY = lerp(lower.docY, upper.docY, t) - Math.sin(t * Math.PI) * arcH;
    const x = lerp(lower.x, upper.x, easeInOut(t));
    const dx = upper.x - lower.x;
    if (Math.abs(dx) > 6) this.climbFace = dx < 0 ? -1 : 1;
    this.face = this.climbFace;
    const last = upper.docY <= L.heroGround + 1;

    let pose: Pose;
    if (t < 0.1) pose = mix(POSES.idle, POSES.crouch, easeInOut(t / 0.1));
    else if (t < 0.24) pose = mix(POSES.crouch, POSES.leap, easeOut((t - 0.1) / 0.14));
    else if (t < 0.82) pose = POSES.leap;
    else if (t < 0.93) pose = mix(POSES.leap, POSES.crouch, easeInOut((t - 0.82) / 0.11));
    else pose = mix(POSES.crouch, POSES.idle, easeOut((t - 0.93) / 0.07));
    if (last && t >= 1) this.face = -1;

    // Paused mid-leap: hover.
    const still = now - this.lastMoveAt > 450 && t > 0.1 && t < 0.9;
    if (still) {
      const bob = Math.sin(now / 700) * 5;
      const f = this.base(x, docY - scrollY + bob, mix(pose, POSES.hang, 0.8));
      f.shadow = 0;
      return f;
    }
    const f = this.base(x, docY - scrollY, pose);
    f.shadow = t < 0.1 || t > 0.9 ? 1 : 0;
    return f;
  }

  /* ── reduced motion: he exists, he doesn't perform ─────────────────── */

  private reducedFrame(scrollY: number, K: ReturnType<Director["key"]>): Frame {
    const L = this.layout!;
    if (scrollY <= K.sPin) { const f = this.base(L.standX, this.groundY, POSES.idle); f.attached = true; return f; }
    if (scrollY >= K.sLandStart) return this.base(L.footerX, L.footerGround - scrollY, POSES.idle);
    const f = this.base(L.laneX, -999, POSES.idle);
    f.opacity = 0;
    return f;
  }
}
