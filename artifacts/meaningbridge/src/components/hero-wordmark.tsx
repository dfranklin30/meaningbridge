import { motion, useReducedMotion } from "framer-motion";

type Props = {
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
};

// The "MeaningBridge" wordmark drawn as SVG letterforms: every letter shares the
// same serif, size and weight. The whole word is traced first (stroke draw),
// then fills in with the navy -> teal of the infinity-bridge mark. Once settled,
// a single soft light travels continuously along the outline of the entire word
// — the continuing bond in motion, the same light that drifts along the infinity
// ribbon in the background. Uniform letters, one palette, one animation.
// Honors prefers-reduced-motion by rendering the finished state at rest.
export function HeroWordmark({
  className = "",
  "aria-hidden": ariaHidden,
}: Props) {
  const reduce = useReducedMotion();

  return (
    <svg
      viewBox="0 0 880 150"
      className={className}
      aria-hidden={ariaHidden}
      role={ariaHidden ? undefined : "img"}
      aria-label={ariaHidden ? undefined : "MeaningBridge"}
    >
      <defs>
        <linearGradient id="hero-wordmark-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--brand-navy)" />
          <stop offset="100%" stopColor="var(--brand-teal)" />
        </linearGradient>
        {/* The travelling light along the outline of the whole word. A single
            bright teal band drifts across the letters (repeat-tiled so it is
            seamless), echoing the light moving along the infinity ribbon. */}
        <linearGradient
          id="hero-flow"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="420"
          y2="0"
          spreadMethod="repeat"
        >
          <stop offset="0%" stopColor="var(--brand-teal)" />
          <stop offset="44%" stopColor="var(--brand-teal)" />
          <stop offset="50%" stopColor="#eafefb" />
          <stop offset="56%" stopColor="var(--brand-teal)" />
          <stop offset="100%" stopColor="var(--brand-teal)" />
          {!reduce && (
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              from="0 0"
              to="420 0"
              dur="3.6s"
              repeatCount="indefinite"
            />
          )}
        </linearGradient>
      </defs>
      <motion.text
        x="440"
        y="75"
        textAnchor="middle"
        dominantBaseline="central"
        textLength="820"
        lengthAdjust="spacingAndGlyphs"
        fontFamily='"Newsreader", serif'
        fontSize="104"
        fontWeight={500}
        letterSpacing="-2"
        fill="url(#hero-wordmark-gradient)"
        stroke="url(#hero-flow)"
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeDasharray={2600}
        initial={
          reduce
            ? { strokeDashoffset: 0, fillOpacity: 1 }
            : { strokeDashoffset: 2600, fillOpacity: 0 }
        }
        animate={{ strokeDashoffset: 0, fillOpacity: 1 }}
        transition={
          reduce
            ? { duration: 0 }
            : {
                strokeDashoffset: {
                  duration: 2.4,
                  ease: [0.22, 1, 0.36, 1],
                },
                fillOpacity: {
                  duration: 1.3,
                  delay: 1.5,
                  ease: "easeInOut",
                },
              }
        }
      >
        MeaningBridge
      </motion.text>
    </svg>
  );
}
