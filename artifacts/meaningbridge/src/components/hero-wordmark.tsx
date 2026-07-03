import { motion, useReducedMotion } from "framer-motion";

type Props = {
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
};

// The "MeaningBridge" wordmark drawn as SVG letterforms: the outline of each
// letter is traced first (stroke draw), then the letters fill in — echoing the
// navy -> teal of the infinity-bridge mark. Honors prefers-reduced-motion by
// rendering the finished state at rest.
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
        stroke="url(#hero-wordmark-gradient)"
        strokeWidth={1.4}
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
