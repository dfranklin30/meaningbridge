import { useMemo } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

/**
 * A calm, living orb — soft navy-to-teal light with clouds drifting through it,
 * in the spirit of a voice-assistant sphere but tuned to MeaningBridge's quiet
 * palette. It breathes when idle, ripples with the speaker's voice while
 * listening, swirls while thinking, and glows while the companion speaks.
 * `level` (0..1) gently scales it with live audio. Honors reduced motion.
 */
export function VoiceOrb({
  state,
  level = 0,
  size = 240,
}: {
  state: OrbState;
  level?: number;
  size?: number;
}) {
  const lvl = Math.max(0, Math.min(1, level));

  const cfg = useMemo(() => {
    switch (state) {
      case "listening":
        return { drift: "11s", glow: 0.5, ring: 0.55 };
      case "thinking":
        return { drift: "7s", glow: 0.45, ring: 0.4 };
      case "speaking":
        return { drift: "5.5s", glow: 0.7, ring: 0.6 };
      default:
        return { drift: "20s", glow: 0.28, ring: 0.3 };
    }
  }, [state]);

  const scale =
    1 + lvl * 0.14 + (state === "speaking" ? 0.03 : state === "thinking" ? 0.01 : 0);

  const css = `
    @keyframes mbDriftA { 0%{transform:translate(-14%,-8%) rotate(0deg) scale(1.05)} 50%{transform:translate(10%,12%) rotate(180deg) scale(1.15)} 100%{transform:translate(-14%,-8%) rotate(360deg) scale(1.05)} }
    @keyframes mbDriftB { 0%{transform:translate(12%,-12%) rotate(0deg) scale(1.1)} 50%{transform:translate(-10%,8%) rotate(-180deg) scale(1)} 100%{transform:translate(12%,-12%) rotate(-360deg) scale(1.1)} }
    @keyframes mbDriftC { 0%{transform:translate(0%,10%) rotate(0deg) scale(1)} 50%{transform:translate(6%,-10%) rotate(160deg) scale(1.2)} 100%{transform:translate(0%,10%) rotate(360deg) scale(1)} }
    @keyframes mbBreath { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
    @keyframes mbHalo { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:.85;transform:scale(1.08)} }
    @media (prefers-reduced-motion: reduce) {
      .mb-orb-cloud, .mb-orb-breath, .mb-orb-halo { animation: none !important; }
    }
  `;

  const cloudBase = {
    position: "absolute" as const,
    inset: "-30%",
    borderRadius: "9999px",
    filter: "blur(14px)",
    mixBlendMode: "screen" as const,
  };

  return (
    <div
      style={{ width: size, height: size, position: "relative" }}
      className="mb-orb-breath"
    >
      <style>{css}</style>

      {/* Outer halo */}
      <div
        className="mb-orb-halo"
        aria-hidden
        style={{
          position: "absolute",
          inset: "-22%",
          borderRadius: "9999px",
          background:
            "radial-gradient(circle at 50% 50%, hsl(180 55% 55% / 0.5), hsl(200 60% 45% / 0.25) 45%, transparent 70%)",
          filter: "blur(26px)",
          opacity: cfg.glow,
          transition: "opacity 700ms ease",
          animation:
            state === "idle" ? "mbHalo 7s ease-in-out infinite" : "mbHalo 3.4s ease-in-out infinite",
        }}
      />

      {/* Orb body */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "9999px",
          overflow: "hidden",
          transform: `scale(${scale})`,
          transition: "transform 140ms ease-out",
          background:
            "radial-gradient(circle at 34% 30%, hsl(196 60% 42%), hsl(210 52% 26%) 55%, hsl(220 55% 16%) 100%)",
          boxShadow:
            `inset 0 0 60px hsl(220 60% 10% / 0.6), 0 20px 60px -20px hsl(200 60% 30% / ${cfg.ring})`,
        }}
      >
        {/* Drifting clouds */}
        <div
          className="mb-orb-cloud"
          style={{
            ...cloudBase,
            background:
              "radial-gradient(closest-side, hsl(174 70% 62% / 0.85), transparent)",
            animation: `mbDriftA ${cfg.drift} linear infinite`,
          }}
        />
        <div
          className="mb-orb-cloud"
          style={{
            ...cloudBase,
            background:
              "radial-gradient(closest-side, hsl(205 80% 66% / 0.7), transparent)",
            animation: `mbDriftB calc(${cfg.drift} * 1.3) linear infinite`,
          }}
        />
        <div
          className="mb-orb-cloud"
          style={{
            ...cloudBase,
            background:
              "radial-gradient(closest-side, hsl(160 65% 70% / 0.6), transparent)",
            animation: `mbDriftC calc(${cfg.drift} * 0.85) linear infinite`,
          }}
        />
        {/* Specular highlight */}
        <div
          style={{
            position: "absolute",
            top: "12%",
            left: "18%",
            width: "40%",
            height: "34%",
            borderRadius: "9999px",
            background:
              "radial-gradient(circle at 40% 40%, hsl(0 0% 100% / 0.55), transparent 70%)",
            filter: "blur(6px)",
          }}
        />
        {/* Inner rim light */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "9999px",
            boxShadow: "inset 0 -14px 40px hsl(174 70% 60% / 0.35)",
          }}
        />
      </div>
    </div>
  );
}
