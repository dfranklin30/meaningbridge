import { motion } from "framer-motion";

/**
 * BridgeAnimation
 * A calm, abstract SVG scene showing three presences connected by a
 * gently breathing pair of bridge arcs (echoing the infinity/bridge logo):
 *   - Seeker (someone grieving)
 *   - Companion (the AI presence)
 *   - Clinician (therapist / doctor)
 * A small "memory" sits above the Seeker as a continuing-bonds cue.
 * Movement is slow, ease-in-out, and never gamified.
 */

const NAVY = "hsl(215, 38%, 22%)";
const TEAL = "hsl(180, 38%, 38%)";
const TEAL_SOFT = "hsl(180, 38%, 65%)";
const SAND = "hsl(30, 35%, 70%)";

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

export function BridgeAnimation() {
  // Layout: three figures across, memory above-left, on a 600x320 viewBox.
  const seeker = { cx: 130, cy: 200 };
  const companion = { cx: 300, cy: 200 };
  const clinician = { cx: 470, cy: 200 };

  // Bridge-shaped arcs between figures
  const arcSeekerCompanion = `M ${seeker.cx + 22} ${seeker.cy - 18}
    Q ${(seeker.cx + companion.cx) / 2} ${seeker.cy - 90}
    ${companion.cx - 22} ${companion.cy - 18}`;
  const arcCompanionClinician = `M ${companion.cx + 22} ${companion.cy - 18}
    Q ${(companion.cx + clinician.cx) / 2} ${companion.cy - 90}
    ${clinician.cx - 22} ${clinician.cy - 18}`;
  // Subtle direct human-to-human arc underneath the bridge — quietly reinforces
  // that the human bond is primary; AI sits above as an augment.
  const humanArc = `M ${seeker.cx + 22} ${seeker.cy + 18}
    Q ${(seeker.cx + clinician.cx) / 2} ${clinician.cy + 90}
    ${clinician.cx - 22} ${clinician.cy + 18}`;

  return (
    <div className="w-full">
      <svg
        viewBox="0 0 600 320"
        className="w-full h-auto"
        role="img"
        aria-label="An abstract animation of a person, an AI companion, and a clinician connected by gentle bridge arcs, with a small memory of a loved one floating above."
      >
        {/* Soft horizon backdrop */}
        <defs>
          <linearGradient id="horizon" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(180, 50%, 95%)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="hsl(36, 40%, 98%)" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="memoryGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={SAND} stopOpacity="0.55" />
            <stop offset="100%" stopColor={SAND} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="600" height="320" fill="url(#horizon)" />

        {/* The continuing-bonds memory — a softly floating presence above the seeker */}
        <g>
          <motion.circle
            cx={seeker.cx - 20}
            cy={70}
            fill="url(#memoryGlow)"
            initial={{ r: 32, opacity: 0.7 }}
            animate={{ r: [32, 40, 32], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.circle
            cx={seeker.cx - 20}
            cy={70}
            r={5}
            fill={SAND}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* dotted thread linking memory to seeker */}
          <motion.path
            d={`M ${seeker.cx - 20} 80 Q ${seeker.cx - 10} 130 ${seeker.cx} ${seeker.cy - 28}`}
            stroke={SAND}
            strokeOpacity={0.5}
            strokeWidth={1}
            strokeDasharray="2 5"
            fill="none"
            animate={{ strokeDashoffset: [0, -14] }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          />
          <text
            x={seeker.cx - 20}
            y={42}
            textAnchor="middle"
            fontFamily="Fraunces, serif"
            fontSize={11}
            fontStyle="italic"
            fill="hsl(215, 38%, 30%)"
            opacity={0.75}
          >
            a loved one, remembered
          </text>
        </g>

        {/* Connections */}
        <ConnectionArc d={arcSeekerCompanion} delay={0} />
        <ConnectionArc d={arcCompanionClinician} delay={1.2} />
        <ConnectionArc d={humanArc} delay={2.4} />

        {/* Figures */}
        <Figure
          cx={seeker.cx}
          cy={seeker.cy}
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
