/**
 * An honest 8-frame hand-drawn walk cycle.
 *
 * Eight discrete poses (contact / down / pass / up, twice — the second half
 * mirrors the first), swapped at ~11fps with steps timing. No tweening, no
 * runtime library: it is frame-by-frame animation, which is one of the three
 * things this studio sells. Roughly 4KB of markup, sharp at any size.
 */

type Pose = {
  tR: number; kR: number; // right thigh angle / knee bend
  tL: number; kL: number; // left thigh angle / knee bend
  aR: number; aL: number; // right / left upper-arm angle
  bob: number;            // vertical body bob
};

const FRAMES: Pose[] = [
  { tR:  25, kR:  2, tL: -25, kL: 16, aR: -26, aL:  26, bob:  0 }, // 1 contact R
  { tR:  10, kR: 18, tL: -32, kL: 26, aR: -16, aL:  16, bob:  3 }, // 2 down
  { tR:  -5, kR:  8, tL: -10, kL: 56, aR:  -5, aL:   5, bob:  0 }, // 3 pass
  { tR: -18, kR:  3, tL:  12, kL: 36, aR:   9, aL:  -9, bob: -3 }, // 4 up
  { tR: -25, kR: 16, tL:  25, kL:  2, aR:  26, aL: -26, bob:  0 }, // 5 contact L
  { tR: -32, kR: 26, tL:  10, kL: 18, aR:  16, aL: -16, bob:  3 }, // 6 down
  { tR: -10, kR: 56, tL:  -5, kL:  8, aR:   5, aL:  -5, bob:  0 }, // 7 pass
  { tR:  12, kR: 36, tL: -18, kL:  3, aR:  -9, aL:   9, bob: -3 }, // 8 up
];

const HIP: [number, number] = [60, 112];
const SHOULDER: [number, number] = [60, 66];
const THIGH = 40;
const SHIN = 42;
const UPPER_ARM = 28;
const FOREARM = 28;

/** Walk a limb segment out from a joint. 0deg = straight down, + = forward. */
function tip([cx, cy]: [number, number], deg: number, len: number): [number, number] {
  const r = (deg * Math.PI) / 180;
  // Rounded: unrounded floats serialise differently on server vs client and
  // trip a React hydration mismatch.
  const round = (n: number) => Math.round(n * 100) / 100;
  return [round(cx + len * Math.sin(r)), round(cy + len * Math.cos(r))];
}

function Leg({ thigh, knee, near }: { thigh: number; knee: number; near: boolean }) {
  const kneePt = tip(HIP, thigh, THIGH);
  // The knee bends backwards, so the shin trails the thigh.
  const footPt = tip(kneePt, thigh - knee, SHIN);
  return (
    <g
      stroke={near ? "var(--ink)" : "var(--ink)"}
      opacity={near ? 1 : 0.28}
      strokeWidth={13}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <polyline points={`${HIP[0]},${HIP[1]} ${kneePt[0]},${kneePt[1]} ${footPt[0]},${footPt[1]}`} />
    </g>
  );
}

function Arm({ angle, near }: { angle: number; near: boolean }) {
  const elbowPt = tip(SHOULDER, angle, UPPER_ARM);
  const handPt = tip(elbowPt, angle - 22, FOREARM);
  return (
    <g
      stroke="var(--ink)"
      opacity={near ? 1 : 0.28}
      strokeWidth={10}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <polyline
        points={`${SHOULDER[0]},${SHOULDER[1]} ${elbowPt[0]},${elbowPt[1]} ${handPt[0]},${handPt[1]}`}
      />
    </g>
  );
}

function Frame({ pose }: { pose: Pose }) {
  return (
    <g transform={`translate(0 ${pose.bob})`}>
      {/* far side first — flat opacity for depth, never a gradient */}
      <Leg thigh={pose.tL} knee={pose.kL} near={false} />
      <Arm angle={pose.aL} near={false} />

      {/* torso: one round-capped stroke reads as a body */}
      <line
        x1={SHOULDER[0]}
        y1={SHOULDER[1] - 4}
        x2={HIP[0]}
        y2={HIP[1]}
        stroke="var(--ink)"
        strokeWidth={20}
        strokeLinecap="round"
      />
      <circle cx={60} cy={42} r={15} fill="var(--ink)" />

      {/* near side on top */}
      <Leg thigh={pose.tR} knee={pose.kR} near />
      <Arm angle={pose.aR} near />
    </g>
  );
}

export default function WalkCycle({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 200"
      role="img"
      aria-label="An animated figure walking"
      style={{ overflow: "visible" }}
    >
      {FRAMES.map((pose, i) => (
        <g
          key={i}
          style={{
            opacity: 0,
            animation: "fbf var(--cycle, 0.72s) steps(1, end) infinite",
            animationDelay: `calc(var(--cycle, 0.72s) * ${i} / 8)`,
          }}
        >
          <Frame pose={pose} />
        </g>
      ))}
    </svg>
  );
}
