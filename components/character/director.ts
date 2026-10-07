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

import { POSES, type Pose, mix, walkPose, clamp, lerp, easeInOut, easeOut } from "./rig";

export type Platform = { docY: number; x: number };
/** A content box he can kick off on the way up: vertical range + right edge, document coords. */
export type Wall = { top: number; bottom: number; right: number };

export type Layout = {
  vw: number;
  vh: number;
  maxScroll: number;      // document height − viewport height
  scale: number;
  behind: boolean;        // layer sits behind content (no gutter to fall down)
  laneX: number;          // viewport x of the fall lane
  standX: number;         // where he idles in the hero
  holeX: number;
  switchX: number;        // viewport x of the screen switch
  emergeX: number;        // where he walks in from
  heroGround: number;     // document y
  footerGround: number;   // document y
  footerX: number;        // where he lands
  workTop: number;        // document y where the page turns Charcoal
  contentRight: number;   // viewport x of the content column's right edge
  walls: Wall[];          // boxes near the lane he can kick off
  platforms: Platform[];  // kept for reference; the climb now uses walls
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
};

type Mode = "down" | "up";
type Intro = "waiting" | "walk" | "turn" | "reach" | "turn2" | "walk2" | "settle" | "done";

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
    const pinY = clamp(L.vh * 0.42, 150, L.vh * 0.6);
    const sPin = L.heroGround - pinY;
    const jumpLen = clamp(L.vh * 0.28, 120, 320);
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

  update(now: number, scrollY: number): Frame | null {
    const L = this.layout;
    if (!L) return null;
    const dt = this.lastNow ? Math.min(0.05, (now - this.lastNow) / 1000) : 1 / 60;
    this.lastNow = now;

    // Velocity, smoothed. Direction flips only past a small threshold so a
    // trackpad jitter doesn't flip him mid-air.
    const raw = dt > 0 ? (scrollY - this.lastScroll) / dt : 0;
    this.lastScroll = scrollY;
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

    let f: Frame;
    if (this.reduced) f = this.reducedFrame(scrollY, K);
    else if (this.intro !== "done" && this.intro !== "waiting") f = this.introFrame(now, scrollY, dt);
    else if (scrollY <= K.sJumpStart) f = this.heroIdle(now, scrollY, dt);
    else if (this.mode === "up") f = this.climbFrame(now, scrollY, K);
    else if (scrollY <= K.sPin) f = this.jumpIn(scrollY, K);
    else if (scrollY < K.sLandStart) f = this.fallFrame(now, scrollY, K);
    else if (scrollY < K.sLand) f = this.landApproach(scrollY, K);
    else f = this.bottomFrame(now, scrollY, K);

    // Impact detection: crossed the landing point going down.
    const above = scrollY < K.sLand;
    if (this.wasAbove && !above && this.mode === "down" && !this.reduced) {
      this.landedAt = now;
      f.thud = true;
    }
    if (above && scrollY < K.sLandStart) this.landedAt = 0;
    this.wasAbove = above;

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

    f.dark = scrollY + (f.y) > L.workTop;
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

  private introFrame(now: number, scrollY: number, dt: number): Frame {
    const L = this.layout!;
    const gy = L.heroGround - scrollY;
    const t = now - this.introT0;
    const walkMs = 700, turnMs = 220, reachMs = 650;
    const nearSwitch = L.switchX + 40 * L.scale;

    if (this.intro === "walk") {
      const q = clamp(t / walkMs, 0, 1);
      this.face = 1;
      this.walkPhase += dt * 2.1;
      const x = lerp(L.emergeX, nearSwitch + 26 * L.scale, easeOut(q));
      const pose = q < 0.96 ? walkPose(this.walkPhase) : mix(walkPose(this.walkPhase), POSES.idle, (q - 0.96) / 0.04);
      const f = this.base(x, gy, pose);
      f.opacity = clamp(q * 5, 0, 1);
      if (q >= 1) { this.intro = "turn"; this.introT0 = now; }
      return f;
    }
    if (this.intro === "turn") {
      const q = clamp(t / turnMs, 0, 1);
      this.face = q < 0.5 ? 1 : -1;
      const f = this.base(nearSwitch + 26 * L.scale, gy, mix(POSES.idle, POSES.look, Math.sin(q * Math.PI)));
      if (q >= 1) { this.intro = "reach"; this.introT0 = now; }
      return f;
    }
    if (this.intro === "reach") {
      const q = clamp(t / reachMs, 0, 1);
      this.face = -1;
      const reachAmt = Math.sin(q * Math.PI);
      const x = lerp(nearSwitch + 26 * L.scale, nearSwitch, reachAmt);
      if (q > 0.45 && !this.screenOn) this.fireScreen();
      const f = this.base(x, gy, mix(POSES.idle, POSES.reach, reachAmt));
      if (q >= 1) { this.intro = "turn2"; this.introT0 = now; }
      return f;
    }
    if (this.intro === "turn2") {
      const q = clamp(t / turnMs, 0, 1);
      this.face = q < 0.5 ? -1 : 1;
      const f = this.base(nearSwitch + 26 * L.scale, gy, mix(POSES.idle, POSES.look, Math.sin(q * Math.PI) * 0.6));
      if (q >= 1) { this.intro = "walk2"; this.introT0 = now; this.walkFrom = nearSwitch + 26 * L.scale; }
      return f;
    }
    if (this.intro === "walk2") {
      const dist = Math.max(1, L.standX - this.walkFrom);
      const ms = clamp((dist / 380) * 1000, 300, 2600);
      const q = clamp(t / ms, 0, 1);
      this.face = 1;
      this.walkPhase += dt * 2.1;
      const x = lerp(this.walkFrom, L.standX, q < 0.9 ? q / 0.9 * 0.97 : 0.97 + easeOut((q - 0.9) / 0.1) * 0.03);
      const pose = q < 0.94 ? walkPose(this.walkPhase) : mix(walkPose(this.walkPhase), POSES.idle, (q - 0.94) / 0.06);
      const f = this.base(x, gy, pose);
      if (q >= 1) { this.intro = "settle"; this.introT0 = now; }
      return f;
    }
    // settle: turn to face the page
    const q = clamp(t / turnMs, 0, 1);
    this.face = q < 0.5 ? 1 : -1;
    const f = this.base(L.standX, gy, mix(POSES.idle, POSES.look, Math.sin(q * Math.PI) * 0.5));
    if (q >= 1) { this.intro = "done"; this.face = -1; }
    return f;
  }

  private heroIdle(now: number, scrollY: number, dt: number): Frame {
    const L = this.layout!;
    const gy = L.heroGround - scrollY;
    // Weight shift + breathing, slow; head follows the cursor on desktop.
    const breathe = Math.sin(now / 900) * 0.5 + 0.5;
    let pose = mix(POSES.idle, POSES.look, breathe * 0.25);
    if (this.intro === "waiting") pose = POSES.idle;
    if (this.mouse.has && !this.lowPower) {
      const dx = clamp((this.mouse.x - L.standX) / L.vw, -1, 1);
      this.face = dx > 0.04 ? 1 : -1;
      pose = { ...pose, head: pose.head + Math.abs(dx) * 7, lean: pose.lean + Math.abs(dx) * 3 };
    } else this.face = -1;
    const f = this.base(L.standX, gy, pose);
    if (this.intro === "waiting") f.opacity = 0;
    return f;
  }

  private jumpIn(scrollY: number, K: ReturnType<Director["key"]>): Frame {
    const L = this.layout!;
    const q = clamp((scrollY - K.sJumpStart) / K.jumpLen, 0, 1);
    const gy = L.heroGround - scrollY;
    this.face = 1;
    const arcH = clamp(L.vh * 0.09, 36, 80);
    let pose: Pose;
    if (q < 0.22) pose = mix(POSES.idle, POSES.crouch, easeInOut(q / 0.22));
    else if (q < 0.4) pose = mix(POSES.crouch, POSES.leap, easeOut((q - 0.22) / 0.18));
    else if (q < 0.8) pose = mix(POSES.leap, POSES.fall, easeInOut((q - 0.4) / 0.4));
    else pose = POSES.fall;
    const travel = q < 0.22 ? 0 : easeInOut((q - 0.22) / 0.78);
    const x = lerp(L.standX, L.holeX, travel);
    const y = gy - Math.sin(travel * Math.PI) * arcH;
    const f = this.base(x, y, pose);
    f.shadow = q < 0.22 ? 1 : 0;
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
    const y = lerp(K.pinY + 70 * L.scale, groundY, easeInOut(q));
    const x = lerp(L.laneX, L.footerX, easeInOut(q));
    const pose = q < 0.75 ? mix(POSES.fall, POSES.brace, easeInOut(q / 0.75)) : mix(POSES.brace, POSES.heroLand, easeOut((q - 0.75) / 0.25));
    this.face = 1;
    const f = this.base(x, y, pose);
    f.shadow = clamp((q - 0.5) * 2, 0, 1) * 0.8;
    f.speed = clamp(0.35 - q * 0.35, 0, 1);
    return f;
  }

  private bottomFrame(now: number, scrollY: number, K: ReturnType<Director["key"]>): Frame {
    const L = this.layout!;
    const gy = L.footerGround - scrollY;
    const since = this.landedAt ? now - this.landedAt : 99999;
    let pose: Pose;
    let burst = 0;
    if (since < 520) { pose = POSES.heroLand; burst = since / 520; }
    else if (since < 980) pose = mix(POSES.heroLand, POSES.rise, easeInOut((since - 520) / 460));
    else if (since < 1300) pose = mix(POSES.rise, POSES.idle, easeOut((since - 980) / 320));
    else if (since < 1650) pose = mix(POSES.idle, POSES.brushL, Math.sin(((since - 1300) / 350) * Math.PI));
    else if (since < 2000) pose = mix(POSES.idle, POSES.brushR, Math.sin(((since - 1650) / 350) * Math.PI));
    else {
      // Idle, with a point at the footer CTA every few seconds.
      const cyc = ((now / 1000) % 6) / 6;
      const pt = cyc > 0.7 ? Math.sin(((cyc - 0.7) / 0.3) * Math.PI) : 0;
      pose = mix(mix(POSES.idle, POSES.look, Math.sin(now / 900) * 0.5 + 0.5 * 0.25), POSES.point, pt);
    }
    this.face = 1;
    const f = this.base(L.footerX, gy, pose);
    f.burst = burst;
    f.speed = 0;
    void K;
    return f;
  }

  /* ── the climb: wall kicks up the lane ─────────────────────────────── */

  private climbFrame(now: number, scrollY: number, K: ReturnType<Director["key"]>): Frame {
    const L = this.layout!;
    // His pin eases from where he landed up to the fall line over the first
    // half-viewport of upward scroll, so he climbs up the screen rather than
    // hugging the bottom edge all the way.
    const ease = clamp((K.sLand - scrollY) / (L.vh * 0.5), 0, 1);
    const pin = lerp(K.climbOffset, K.pinY + 70 * L.scale, easeInOut(ease));
    const P = clamp(scrollY + pin, L.heroGround, L.footerGround);           // feet, document y
    const hopH = 96 * L.scale + 44;                                          // document px per hop
    const total = L.footerGround - L.heroGround;
    const nHops = Math.max(1, Math.ceil(total / hopH));
    const climbed = L.footerGround - P;
    const idx = Math.min(nHops - 1, Math.floor(climbed / hopH));
    const t = clamp((climbed - idx * hopH) / hopH, 0, 1);

    // Walls at this height: the viewport edge on the right, the nearest
    // content box (or the content column) on the left of the lane.
    const xRight = L.vw - 22 * L.scale;
    let edge = L.contentRight;
    for (const w of L.walls) if (P >= w.top - 30 && P <= w.bottom + 30) edge = Math.max(edge, w.right);
    let xLeft = edge + 26 * L.scale;
    const single = xLeft > xRight - 36 * L.scale;          // no room: kick off one wall
    if (single) xLeft = xRight - 46 * L.scale;

    // Even hops go right→left, odd hops left→right. The very last hop lands
    // on the hero ground at his spot by the hole.
    const toLeft = idx % 2 === 0;
    let xFrom = toLeft ? xRight : xLeft;
    let xTo = toLeft ? xLeft : xRight;
    const last = idx >= nHops - 1;
    if (last) xTo = L.standX;
    if (idx === 0) xFrom = L.footerX;

    const x = lerp(xFrom, xTo, easeInOut(t));
    const arc = Math.sin(t * Math.PI) * hopH * (single ? 0.25 : 0.4);
    const docY = P - arc;
    this.face = xTo - xFrom < 0 ? -1 : 1;
    if (single) this.face = toLeft ? -1 : 1;

    let pose: Pose;
    if (t < 0.14) pose = mix(POSES.kick, POSES.leap, easeOut(t / 0.14));
    else if (t < 0.8) pose = POSES.leap;
    else pose = mix(POSES.leap, POSES.kick, easeInOut((t - 0.8) / 0.2));
    if (last && t > 0.8) pose = mix(POSES.leap, POSES.idle, easeOut((t - 0.8) / 0.2));

    // Paused mid-climb: hover.
    const still = now - this.lastMoveAt > 450 && !last;
    if (still) {
      const bob = Math.sin(now / 700) * 5;
      pose = mix(pose, POSES.hang, 0.8);
      const f = this.base(x, docY - scrollY + bob, pose);
      f.shadow = 0;
      return f;
    }
    const f = this.base(x, docY - scrollY, pose);
    f.shadow = last && t > 0.9 ? 1 : 0;
    return f;
  }

  /* ── reduced motion: he exists, he doesn't perform ─────────────────── */

  private reducedFrame(scrollY: number, K: ReturnType<Director["key"]>): Frame {
    const L = this.layout!;
    if (scrollY <= K.sPin) return this.base(L.standX, L.heroGround - scrollY, POSES.idle);
    if (scrollY >= K.sLandStart) return this.base(L.footerX, L.footerGround - scrollY, POSES.idle);
    const f = this.base(L.laneX, -999, POSES.idle);
    f.opacity = 0;
    return f;
  }
}
