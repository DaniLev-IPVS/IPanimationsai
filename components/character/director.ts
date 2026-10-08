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
export type Platform = {
  docY: number;
  x: number;
  /** A wall he kicks off: +1 = wall on his right, -1 = wall on his left. */
  wall?: 1 | -1;
  /** The hang point under the hole: the climb ends here with a muscle-up. */
  hang?: boolean;
};

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
   * The climb, bottom → top: on wide screens a ninja zigzag between the
   * viewport edge and the side of the content; on phones a chain of real
   * elements. Both end at the hang point under the hole, where he catches
   * the rim and muscles up. Built by Character.tsx.
   */
  footholds: Platform[];
  hangDepth: number;      // how far below the line his feet hang (px)
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
  /** Gone into the hole: draw behind the band from here on. */
  behindBand?: boolean;
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
  private submitY = NaN;
  private phoneP = 0;
  /** The muscle-up out of the hole: start time, 0 = not playing; done once stood up. */
  private muscleT0 = 0;
  private muscleDone = false;
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

  update(now: number, realScroll: number, groundY: number, submitX: number, submitY: number, phoneP: number): Frame | null {
    const L = this.layout;
    if (!L) return null;
    this.groundY = groundY;
    this.submitX = submitX;
    this.submitY = submitY;
    this.phoneP = phoneP;
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

  /** 0 while the form and points are up, 1 once the phone has fully risen. */
  private stageP(_scrollY: number) {
    return this.phoneP;
  }

  private introFrame(now: number, scrollY: number, dt: number): Frame {
    const L = this.layout!;
    const gy = this.groundY;
    // Landed mid-stage? Skip the walk-in.
    if (this.stageP(scrollY) > 0.1) { this.intro = "done"; return this.heroIdle(now, scrollY, dt); }
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
   * Point at the Submit button from where he stands: up-and-right when it is
   * above-right of him, straight up when he is under it, up-and-left when he
   * has passed it. `bob` wiggles the pointing hand.
   */
  private pointAt(x: number, feetY: number, bob: number): Pose {
    const L = this.layout!;
    let phi = 0; // degrees off straight-up, towards the facing side
    if (!Number.isNaN(this.submitX) && !Number.isNaN(this.submitY)) {
      const dx = this.submitX - x;
      const dy = this.submitY - (feetY - 128 * L.scale); // from the shoulder
      if (Math.abs(dx) > 26) this.face = dx > 0 ? 1 : -1;
      phi = clamp((Math.atan2(Math.abs(dx), Math.max(1, -dy)) * 180) / Math.PI, 0, 100);
      if (Math.abs(dx) <= 26) phi = Math.min(phi, 8);
    }
    const arm = 180 - phi + bob;
    return { ...POSES.pointUp, aR: arm, eR: 2, head: 3 + phi * 0.04, lean: 2 + phi * 0.05 };
  }

  /**
   * The excitement jump: crouch, a real leap with a mid-air leg scramble,
   * a landing squash, then up into the point. Returns pose and lift (px above
   * the ground) for time t (ms since it started). Holds the point after.
   */
  private gesture(t: number, now: number, x: number, feetY: number): { pose: Pose; lift: number } {
    const L = this.layout!;
    const bob = Math.sin(now / 300) * 7; // the pointing hand bobs
    if (t < 200) return { pose: mix(POSES.idle, POSES.crouch, easeInOut(t / 200)), lift: 0 };
    if (t < 860) {
      const u = (t - 200) / 660;
      const lift = Math.sin(u * Math.PI) * 92 * L.scale;
      // Legs scramble as if he is trying to catch himself.
      const k = Math.sin(t / 38) * 26;
      const air: Pose = { ...POSES.leap, tR: 22 + k, tL: -18 - k, kR: 48 + Math.abs(k), kL: 40 + Math.abs(k), aR: 150 + Math.sin(t / 60) * 10, aL: 160 - Math.sin(t / 60) * 10, lean: -4 + Math.sin(t / 90) * 6 };
      const pose = u < 0.18 ? mix(POSES.crouch, air, easeOut(u / 0.18)) : u > 0.85 ? mix(air, POSES.brace, (u - 0.85) / 0.15) : air;
      return { pose, lift };
    }
    if (t < 1010) {
      // Landing squash.
      const u = (t - 860) / 150;
      const sq = Math.sin(u * Math.PI);
      const pose = mix(POSES.brace, POSES.crouch, Math.min(1, u * 2));
      return { pose: { ...pose, sx: 1 + sq * 0.14, sy: 1 - sq * 0.14 }, lift: 0 };
    }
    if (t < 1320) return { pose: mix(POSES.crouch, this.pointAt(x, feetY, 0), easeOut((t - 1010) / 310)), lift: 0 };
    return { pose: this.pointAt(x, feetY, bob), lift: 0 };
  }

  /**
   * Out of the hole: hands on the rim, a pull, a mantle over the edge, stand.
   * Time-based; the body below the line is hidden by the band.
   */
  private muscleUp(now: number): Frame | null {
    const L = this.layout!;
    if (!this.muscleT0 || this.muscleDone) return null;
    const t = now - this.muscleT0;
    const gy = this.groundY;
    const depth = L.hangDepth;
    this.face = -1; // facing the page, back to the edge
    let pose: Pose;
    let y: number;
    let x = L.holeX;
    if (t < 420) {
      // Hanging, a little swing.
      pose = { ...POSES.hangRim, lean: Math.sin(t / 140) * 4 };
      y = gy + depth;
    } else if (t < 1100) {
      const u = easeInOut((t - 420) / 680);
      pose = u < 0.55 ? mix(POSES.hangRim, POSES.pullUp, u / 0.55) : mix(POSES.pullUp, POSES.mantle, (u - 0.55) / 0.45);
      y = gy + depth * (1 - u);
    } else if (t < 1500) {
      const u = easeOut((t - 1100) / 400);
      pose = mix(POSES.mantle, POSES.crouch, u);
      y = gy;
      x = lerp(L.holeX, L.standX, u * 0.6);
    } else if (t < 1850) {
      const u = easeOut((t - 1500) / 350);
      pose = mix(POSES.crouch, POSES.idle, u);
      y = gy;
      x = lerp(L.holeX, L.standX, 0.6 + u * 0.4);
    } else {
      this.muscleDone = true;
      return null;
    }
    const f = this.base(x, y, pose);
    f.attached = true;
    f.behindBand = t < 1100; // below the line until he is over the edge
    f.shadow = t >= 1100 ? 1 : 0;
    return f;
  }

  private heroIdle(now: number, scrollY: number, dt: number): Frame {
    const L = this.layout!;
    const gy = this.groundY;
    const mu = this.muscleUp(now);
    if (mu) return mu;
    const p = this.stageP(scrollY);
    const breathe = Math.sin(now / 900) * 0.5 + 0.5;
    const stillFor = now - this.lastMoveAt;
    let x: number;
    let pose: Pose;
    let lift = 0;

    if (p < 0.04) {
      // Form and points phase: by the form, pointing at Submit, with a jump of
      // excitement every few seconds.
      x = L.leftX;
      if (!this.gestureT0 || (now - this.gestureT0 > 4600 && stillFor > 400)) this.gestureT0 = now;
      const g = this.gesture(now - this.gestureT0, now, x, gy);
      pose = g.pose;
      lift = g.lift;
    } else if (p < 0.9) {
      // Walking across as the phone takes the screen. Pause the scroll and he
      // stops, hops, and points back at the Submit button.
      const t = easeInOut((p - 0.04) / 0.86);
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
        const g = this.gesture(now - this.gestureT0, now, x, gy);
        pose = g.pose;
        lift = g.lift;
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
    f.shadow = lift > 0 ? clamp(1 - lift / (60 * L.scale), 0.15, 1) : pose.grounded;
    if (this.intro === "waiting") f.opacity = 0;
    void dt;
    return f;
  }

  private jumpIn(scrollY: number, K: ReturnType<Director["key"]>): Frame {
    const L = this.layout!;
    const q = clamp((scrollY - K.sJumpStart) / K.jumpLen, 0, 1);
    const gy = this.groundY;
    this.face = 1;
    if (q > 0.3) { this.muscleT0 = 0; this.muscleDone = false; }
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
    f.behindBand = travel > 0.55; // past the apex: he drops in behind the banner
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

  /* ── the climb: leaps between footholds, ending under the hole ───────── */

  private climbFrame(now: number, scrollY: number, K: ReturnType<Director["key"]>): Frame {
    const L = this.layout!;
    const mu = this.muscleUp(now);
    if (mu) return mu;

    // His pin eases from where he landed up to the fall line over the first
    // half-viewport of upward scroll, so he climbs up the screen rather than
    // hugging the bottom edge all the way.
    const ease = clamp((K.sLand - scrollY) / (L.vh * 0.5), 0, 1);
    const pin = lerp(K.climbOffset, K.pinY, easeInOut(ease));
    const chain = L.footholds; // bottom → top
    const top = chain[chain.length - 1];
    const P = clamp(scrollY + pin, top.docY, L.footerGround); // feet, document y

    // Arrived under the hole: catch the rim and muscle up; once out, stand by
    // the hole until the scroll carries him into the hero's own idle.
    if (P <= top.docY + 1) {
      if (!this.muscleDone) {
        if (!this.muscleT0) this.muscleT0 = now;
        const f = this.muscleUp(now);
        if (f) return f;
      }
      this.face = -1;
      const breathe = Math.sin(now / 900) * 0.5 + 0.5;
      const f = this.base(L.standX, this.groundY, mix(POSES.idle, POSES.look, breathe * 0.25));
      f.attached = true;
      return f;
    }

    let lower = chain[0], upper = top;
    for (let i = 0; i < chain.length - 1; i++) {
      if (chain[i].docY >= P && chain[i + 1].docY <= P) { lower = chain[i]; upper = chain[i + 1]; break; }
    }
    const hop = Math.max(1, lower.docY - upper.docY);
    const t = clamp((lower.docY - P) / hop, 0, 1);
    const wallHop = !!lower.wall || !!upper.wall;
    const arcH = wallHop ? clamp(hop * 0.18, 20 * L.scale, L.vh * 0.2) : clamp(hop * 0.3, 40 * L.scale, L.vh * 0.4);
    const docY = lerp(lower.docY, upper.docY, t) - Math.sin(t * Math.PI) * arcH;
    const x = lerp(lower.x, upper.x, easeInOut(t));
    const dx = upper.x - lower.x;
    if (Math.abs(dx) > 6) this.climbFace = dx < 0 ? -1 : 1;
    this.face = this.climbFace;

    let pose: Pose;
    if (wallHop) {
      // Ninja: coiled against the wall, push off, sail across, hit the next wall feet first.
      if (t < 0.12) pose = mix(POSES.kick, POSES.leap, easeOut(t / 0.12));
      else if (t < 0.8) pose = POSES.leap;
      else pose = mix(POSES.leap, POSES.kick, easeInOut((t - 0.8) / 0.2));
      if (upper.hang && t > 0.75) pose = mix(pose, POSES.hangRim, (t - 0.75) / 0.25);
    } else {
      if (t < 0.1) pose = mix(POSES.idle, POSES.crouch, easeInOut(t / 0.1));
      else if (t < 0.24) pose = mix(POSES.crouch, POSES.leap, easeOut((t - 0.1) / 0.14));
      else if (t < 0.82) pose = POSES.leap;
      else if (upper.hang) pose = mix(POSES.leap, POSES.hangRim, easeInOut((t - 0.82) / 0.18));
      else if (t < 0.93) pose = mix(POSES.leap, POSES.crouch, easeInOut((t - 0.82) / 0.11));
      else pose = mix(POSES.crouch, POSES.idle, easeOut((t - 0.93) / 0.07));
    }

    // Paused mid-leap: hover.
    const still = now - this.lastMoveAt > 450 && t > 0.1 && t < 0.9;
    if (still) {
      const bob = Math.sin(now / 700) * 5;
      const f = this.base(x, docY - scrollY + bob, mix(pose, POSES.hang, 0.8));
      f.shadow = 0;
      return f;
    }
    const f = this.base(x, docY - scrollY, pose);
    f.shadow = !wallHop && (t < 0.1 || t > 0.9) ? 1 : 0;
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
