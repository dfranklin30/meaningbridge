export default function Closing() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-navy font-body text-cream">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60vw 60vw at 90% 110%, hsl(176 58% 45% / 0.22), transparent 60%), radial-gradient(50vw 50vw at 0% -10%, hsl(209 54% 40% / 0.35), transparent 60%)",
        }}
      />
      <svg
        className="absolute left-[6vw] bottom-[-8vh] w-[42vw] opacity-[0.16]"
        viewBox="0 0 300 200"
        fill="none"
      >
        <path
          d="M60 100 C60 55 130 55 150 100 C170 145 240 145 240 100 C240 55 170 55 150 100 C130 145 60 145 60 100 Z"
          stroke="hsl(176 58% 62%)"
          strokeWidth="2.5"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col justify-center px-[9vw]">
        <p className="text-[2.2vw] tracking-[0.32em] uppercase font-medium" style={{ color: "hsl(176 55% 66%)" }}>
          Begin whenever you are ready
        </p>
        <h2
          className="font-display font-normal text-[6vw] leading-[1.05] text-cream mt-[3vh] max-w-[72vw]"
          style={{ textWrap: "balance" }}
        >
          Carry your grief forward, together.
        </h2>
        <div className="mt-[6vh] flex items-center gap-[2.5vw] text-[2.4vw]">
          <span className="font-medium" style={{ color: "hsl(176 55% 68%)" }}>
            meaning-bridge.com
          </span>
          <span className="w-[5vw] h-px" style={{ background: "hsl(176 55% 55% / 0.5)" }} />
          <span className="opacity-80">Dr. Robert Neimeyer</span>
        </div>
        <p className="mt-[2.5vh] text-[2.2vw] opacity-70">
          neimeyer@portlandinstitute.org · Portland Institute for Loss and
          Transition
        </p>
      </div>
    </div>
  );
}
