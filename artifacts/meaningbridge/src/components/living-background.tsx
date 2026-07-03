import { motion, useReducedMotion } from "framer-motion";

/**
 * LivingBackground
 * A slow, breathing atmosphere behind the landing content, drawn from the
 * MeaningBridge logo: a deep navy loop and a bridge-teal loop that meet in
 * the middle. Four large blurred gradient orbs drift in the navy/teal
 * palette, and a faint infinity ribbon is traced overhead with two soft
 * lights that travel its loops — the continuing bond between two worlds,
 * and the integration between those grieving and the professionals who
 * care for them. Movement is 20–60s per cycle, easeInOut/linear, never
 * alarming. Sits behind everything (-z-10) with pointer-events disabled.
 *
 * Honors `prefers-reduced-motion`: when reduced motion is requested the
 * orbs and ribbon render at rest with no animation, so the page is still
 * visually warm but completely still.
 */

const INFINITY_PATH =
  "M100 50 C 78 20, 20 20, 20 50 C 20 80, 78 80, 100 50 C 122 20, 180 20, 180 50 C 180 80, 122 80, 100 50 Z";

export function LivingBackground() {
  const shouldReduce = useReducedMotion();

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden -z-10"
    >
      {/* Base cool wash so the orbs blend, not pop */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% -12%, hsl(176 40% 88% / 0.5) 0%, transparent 55%), radial-gradient(ellipse at 50% 0%, hsl(200 30% 96%) 0%, hsl(192 22% 97%) 60%, hsl(192 22% 97%) 100%)",
        }}
      />

      {/* Navy aurora — top left (the deep loop) */}
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{
          width: "55vw",
          height: "55vw",
          left: "-10vw",
          top: "-10vw",
          background:
            "radial-gradient(circle at center, hsl(209 54% 40% / 0.18), hsl(209 54% 40% / 0) 70%)",
        }}
        animate={shouldReduce ? undefined : { x: [0, 60, -40, 0], y: [0, 40, -20, 0] }}
        transition={shouldReduce ? undefined : { duration: 48, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Teal aurora — top right (the bridge loop) */}
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{
          width: "45vw",
          height: "45vw",
          right: "-12vw",
          top: "5vw",
          background:
            "radial-gradient(circle at center, hsl(176 58% 46% / 0.22), hsl(176 58% 46% / 0) 70%)",
        }}
        animate={shouldReduce ? undefined : { x: [0, -50, 30, 0], y: [0, 30, -20, 0] }}
        transition={shouldReduce ? undefined : { duration: 56, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Soft teal aurora — middle drift */}
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{
          width: "50vw",
          height: "50vw",
          left: "20vw",
          top: "60vh",
          background:
            "radial-gradient(circle at center, hsl(176 50% 50% / 0.12), hsl(176 50% 50% / 0) 70%)",
        }}
        animate={shouldReduce ? undefined : { x: [0, -40, 50, 0], y: [0, -30, 20, 0] }}
        transition={shouldReduce ? undefined : { duration: 64, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Deep navy aurora — bottom right */}
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{
          width: "60vw",
          height: "60vw",
          right: "-15vw",
          bottom: "-20vw",
          background:
            "radial-gradient(circle at center, hsl(209 50% 34% / 0.16), hsl(209 50% 34% / 0) 70%)",
        }}
        animate={shouldReduce ? undefined : { x: [0, 40, -30, 0], y: [0, -50, 20, 0] }}
        transition={shouldReduce ? undefined : { duration: 52, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Infinity ribbon — the bridge between two worlds */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 top-[4vh] w-[min(1100px,94vw)]"
        animate={
          shouldReduce ? undefined : { opacity: [0.85, 1, 0.85], scale: [1, 1.02, 1] }
        }
        transition={
          shouldReduce
            ? undefined
            : { duration: 14, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <svg viewBox="0 0 200 100" className="w-full h-auto" fill="none">
          <defs>
            <linearGradient id="mb-infinity" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(209 54% 30%)" />
              <stop offset="50%" stopColor="hsl(190 50% 42%)" />
              <stop offset="100%" stopColor="hsl(176 58% 40%)" />
            </linearGradient>
          </defs>

          {/* Faint continuous loop */}
          <path
            d={INFINITY_PATH}
            stroke="url(#mb-infinity)"
            strokeWidth={0.6}
            strokeLinecap="round"
            opacity={0.14}
          />

          {/* Two soft lights travelling the loops — one per side, meeting at the bridge */}
          {!shouldReduce && (
            <>
              <motion.path
                d={INFINITY_PATH}
                stroke="url(#mb-infinity)"
                strokeWidth={1}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray="0.14 0.86"
                opacity={0.5}
                initial={{ strokeDashoffset: 0 }}
                animate={{ strokeDashoffset: [0, -1] }}
                transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
              />
              <motion.path
                d={INFINITY_PATH}
                stroke="url(#mb-infinity)"
                strokeWidth={1}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray="0.14 0.86"
                opacity={0.5}
                initial={{ strokeDashoffset: -0.5 }}
                animate={{ strokeDashoffset: [-0.5, -1.5] }}
                transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
              />
            </>
          )}
        </svg>
      </motion.div>
    </div>
  );
}
