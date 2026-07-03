import { motion } from "framer-motion";

/**
 * BridgeAnimation
 * A calm, abstract SVG scene arranged as a triangle:
 *   - You (the person grieving) at the top
 *   - Companion (the AI presence) at the lower left
 *   - Clinician (therapist / doctor) at the lower right
 * At the very centre sits "A Loved One, Remembered" — a softly glowing,
 * dotted-outline presence connected first and foremost to You, quietly
 * reinforcing that the bond with the loved one is central to everything.
 * Gently breathing bridge arcs echo the infinity/bridge logo. Movement is
 * slow, ease-in-out, and never gamified.
 */

const NAVY = "hsl(215, 38%, 22%)";
const TEAL = "hsl(180, 38%, 38%)";
const TEAL_SOFT = "hsl(180, 38%, 65%)";
const SAND = "hsl(30, 35%, 62%)";

type FigureProps = {
  cx: number;
  cy: number;
  label: string;
  sublabel: string;
  color: string;
  delay?: number;
  ai?: boolean;
};

function Figure({ cx, cy, label, sublabel, color, delay = 0, ai = false }: FigureProps) {
  return (
    <g>
      {/* Soft aura */}
      <motion.circle
        cx={cx}
        cy={cy - 6}
        fill={color}
        initial={{ r: 42, opacity: 0.08 }}
        animate={{ r: [42, 50, 42], opacity: [0.08, 0.16, 0.08] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay }}
      />
      {/* Body group with a gentle breath */}
      <motion.g
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay }}
      >
        {ai ? (
          /* AI presence: small infinity glyph instead of a head */
          <g>
            <path
              d={`M ${cx - 14} ${cy - 14}
                 C ${cx - 14} ${cy - 24}, ${cx - 2} ${cy - 24}, ${cx} ${cy - 14}
                 C ${cx + 2} ${cy - 4}, ${cx + 14} ${cy - 4}, ${cx + 14} ${cy - 14}
                 C ${cx + 14} ${cy - 24}, ${cx + 2} ${cy - 24}, ${cx} ${cy - 14}
                 C ${cx - 2} ${cy - 4}, ${cx - 14} ${cy - 4}, ${cx - 14} ${cy - 14} Z`}
              fill="none"
              stroke={color}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ) : (
          <circle cx={cx} cy={cy - 14} r={9} fill={color} />
        )}
        {/* Shoulders / body */}
        <path
          d={`M ${cx - 16} ${cy + 14}
              Q ${cx} ${cy - 2} ${cx + 16} ${cy + 14}
              L ${cx + 16} ${cy + 22}
              L ${cx - 16} ${cy + 22} Z`}
          fill={color}
          opacity={0.85}
        />
      </motion.g>
      {/* Caption */}
      <text
        x={cx}
        y={cy + 44}
        textAnchor="middle"
        fontFamily="Inter, sans-serif"
        fontSize={10}
        fontWeight={500}
        fill={NAVY}
        letterSpacing="0.04em"
      >
        {label.toUpperCase()}
      </text>
      <text
        x={cx}
        y={cy + 56}
        textAnchor="middle"
        fontFamily="Inter, sans-serif"
        fontSize={9}
        fill="hsl(215, 14%, 45%)"
      >
        {sublabel}
      </text>
    </g>
  );
}

type ArcProps = {
  d: string;
  delay?: number;
};

function ConnectionArc({ d, delay = 0 }: ArcProps) {
  return (
    <>
      {/* Base bridge arc — soft, always visible */}
      <path d={d} fill="none" stroke={TEAL_SOFT} strokeOpacity={0.35} strokeWidth={1.2} />
      {/* Pulse of light traveling along the arc */}
      <motion.path
        d={d}
        fill="none"
        stroke={TEAL}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeDasharray="6 240"
        initial={{ strokeDashoffset: 0 }}
        animate={{ strokeDashoffset: [-240, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay }}
      />
    </>
  );
}

/** A soft, dotted-outline thread carrying the continuing bond to the loved one. */
function BondThread({ d, delay = 0, strong = false }: { d: string; delay?: number; strong?: boolean }) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={SAND}
      strokeOpacity={strong ? 0.7 : 0.35}
      strokeWidth={strong ? 1.4 : 1}
      strokeDasharray="2 5"
      strokeLinecap="round"
      animate={{ strokeDashoffset: [0, -14] }}
      transition={{ duration: strong ? 6 : 8, repeat: Infinity, ease: "linear", delay }}
    />
  );
}

export function BridgeAnimation() {
  // Triangular layout on a 600x360 viewBox: You at the apex, Companion and
  // Clinician at the base, the loved one held at the very centre.
  const you = { cx: 300, cy: 90 };
  const companion = { cx: 150, cy: 288 };
  const clinician = { cx: 450, cy: 288 };
  const loved = { cx: 300, cy: 196 };
  const lovedR = 30;

  // Bridge-shaped arcs along the triangle edges (echoing the logo).
  const arcYouCompanion = `M ${you.cx - 12} ${you.cy + 12}
    Q 205 155 ${companion.cx + 20} ${companion.cy - 24}`;
  const arcYouClinician = `M ${you.cx + 12} ${you.cy + 12}
    Q 395 155 ${clinician.cx - 20} ${clinician.cy - 24}`;
  // The long lower line — a direct link between Companion and Clinician.
  const arcBase = `M ${companion.cx + 26} ${companion.cy - 4}
    Q 300 ${companion.cy + 56} ${clinician.cx - 26} ${clinician.cy - 4}`;

  // Continuing-bond threads radiating from the loved one — strongest to You.
  const bondToYou = `M ${loved.cx} ${loved.cy - lovedR}
    Q ${loved.cx} ${(loved.cy - lovedR + you.cy + 24) / 2} ${you.cx} ${you.cy + 24}`;
  const bondToCompanion = `M ${loved.cx - 20} ${loved.cy + 18}
    Q 235 250 ${companion.cx + 16} ${companion.cy - 30}`;
  const bondToClinician = `M ${loved.cx + 20} ${loved.cy + 18}
    Q 365 250 ${clinician.cx - 16} ${clinician.cy - 30}`;

  return (
    <div className="w-full">
      <svg
        viewBox="0 0 600 360"
        className="w-full h-auto"
        role="img"
        aria-label="An abstract animation arranged as a triangle: you at the top, an AI companion and a clinician at the base, all connected by gentle bridge arcs, with a softly glowing loved one held at the very centre and connected first to you."
      >
        <defs>
          <linearGradient id="horizon" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(180, 50%, 95%)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="hsl(36, 40%, 98%)" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="memoryGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={SAND} stopOpacity="0.5" />
            <stop offset="100%" stopColor={SAND} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="600" height="360" fill="url(#horizon)" />

        {/* Triangle edges */}
        <ConnectionArc d={arcYouCompanion} delay={0} />
        <ConnectionArc d={arcYouClinician} delay={1.2} />
        <ConnectionArc d={arcBase} delay={2.4} />

        {/* Continuing-bond threads to the loved one at the centre */}
        <BondThread d={bondToCompanion} delay={0.8} />
        <BondThread d={bondToClinician} delay={1.4} />
        <BondThread d={bondToYou} delay={0} strong />

        {/* The loved one — a softly glowing, dotted-outline presence at the centre */}
        <g>
          <motion.circle
            cx={loved.cx}
            cy={loved.cy}
            fill="url(#memoryGlow)"
            initial={{ r: 46, opacity: 0.7 }}
            animate={{ r: [46, 56, 46], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* dotted outline — an absence that is still present */}
          <motion.circle
            cx={loved.cx}
            cy={loved.cy}
            r={lovedR}
            fill="none"
            stroke={SAND}
            strokeWidth={1.4}
            strokeDasharray="3 5"
            strokeLinecap="round"
            animate={{ rotate: [0, 360] }}
            style={{ transformOrigin: `${loved.cx}px ${loved.cy}px` }}
            transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
          />
          <motion.circle
            cx={loved.cx}
            cy={loved.cy}
            r={5}
            fill={SAND}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <text
            x={loved.cx}
            y={loved.cy + lovedR + 22}
            textAnchor="middle"
            fontFamily="Fraunces, serif"
            fontSize={13}
            fontStyle="italic"
            fill="hsl(215, 38%, 30%)"
            opacity={0.92}
          >
            A Loved One, Remembered
          </text>
        </g>

        {/* Figures */}
        <Figure
          cx={you.cx}
          cy={you.cy}
          color={NAVY}
          label="You"
          sublabel="At your pace"
          delay={0}
        />
        <Figure
          cx={companion.cx}
          cy={companion.cy}
          color={TEAL}
          label="Companion"
          sublabel="A gentle AI presence"
          delay={0.6}
          ai
        />
        <Figure
          cx={clinician.cx}
          cy={clinician.cy}
          color={NAVY}
          label="Clinician"
          sublabel="Human care, always primary"
          delay={1.2}
        />
      </svg>
    </div>
  );
}
