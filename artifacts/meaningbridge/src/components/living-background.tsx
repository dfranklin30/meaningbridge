import { motion, useReducedMotion } from "framer-motion";

/**
 * LivingBackground
 * A slow, breathing aurora behind the landing content. Four large blurred
 * gradient orbs drift along long looping paths in the brand palette
 * (teal, sand, soft navy). Movement is 30–60s per cycle, easeInOut,
 * never alarming. Sits behind everything (-z-10) with pointer-events disabled.
 *
 * Honors `prefers-reduced-motion`: when the user has requested reduced
 * motion, the orbs render in their resting position with no animation,
 * so the page is still visually warm but completely still.
 */
export function LivingBackground() {
  const shouldReduce = useReducedMotion();

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden -z-10"
    >
      {/* Base warm wash so the orbs blend, not pop */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% -12%, hsl(38 55% 90% / 0.45) 0%, transparent 55%), radial-gradient(ellipse at 50% 0%, hsl(80 30% 95%) 0%, hsl(44 32% 97%) 60%, hsl(44 32% 97%) 100%)",
        }}
      />

      {/* Teal aurora — top left */}
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{
          width: "55vw",
          height: "55vw",
          left: "-10vw",
          top: "-10vw",
          background:
            "radial-gradient(circle at center, hsl(90 24% 68% / 0.45), hsl(90 24% 68% / 0) 70%)",
        }}
        animate={shouldReduce ? undefined : { x: [0, 60, -40, 0], y: [0, 40, -20, 0] }}
        transition={shouldReduce ? undefined : { duration: 48, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Sand aurora — top right */}
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{
          width: "45vw",
          height: "45vw",
          right: "-12vw",
          top: "5vw",
          background:
            "radial-gradient(circle at center, hsl(30 60% 78% / 0.45), hsl(30 60% 78% / 0) 70%)",
        }}
        animate={shouldReduce ? undefined : { x: [0, -50, 30, 0], y: [0, 30, -20, 0] }}
        transition={shouldReduce ? undefined : { duration: 56, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Soft navy aurora — middle drift */}
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{
          width: "50vw",
          height: "50vw",
          left: "20vw",
          top: "60vh",
          background:
            "radial-gradient(circle at center, hsl(88 20% 52% / 0.16), hsl(88 20% 52% / 0) 70%)",
        }}
        animate={shouldReduce ? undefined : { x: [0, -40, 50, 0], y: [0, -30, 20, 0] }}
        transition={shouldReduce ? undefined : { duration: 64, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Deep teal aurora — bottom right */}
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{
          width: "60vw",
          height: "60vw",
          right: "-15vw",
          bottom: "-20vw",
          background:
            "radial-gradient(circle at center, hsl(88 22% 44% / 0.24), hsl(88 22% 44% / 0) 70%)",
        }}
        animate={shouldReduce ? undefined : { x: [0, 40, -30, 0], y: [0, -50, 20, 0] }}
        transition={shouldReduce ? undefined : { duration: 52, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
