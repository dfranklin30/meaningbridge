const base = import.meta.env.BASE_URL;

export default function Cover() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-cream font-body text-ink">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(58vw 58vw at 88% -12%, hsl(176 58% 33% / 0.16), transparent 60%), radial-gradient(52vw 52vw at -6% 112%, hsl(209 54% 26% / 0.13), transparent 60%)",
        }}
      />
      <svg
        className="absolute right-[-4vw] bottom-[-10vh] w-[50vw] opacity-[0.09]"
        viewBox="0 0 300 200"
        fill="none"
      >
        <path
          d="M60 100 C60 55 130 55 150 100 C170 145 240 145 240 100 C240 55 170 55 150 100 C130 145 60 145 60 100 Z"
          stroke="hsl(176 58% 33%)"
          strokeWidth="2.5"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <img
          src={`${base}brand/lockup.png`}
          crossOrigin="anonymous"
          alt="MeaningBridge"
          className="h-[12vh] w-auto object-contain self-start mb-[5vh]"
        />
        <h1
          className="font-display font-medium text-[6.4vw] leading-[1.02] tracking-tight text-navy max-w-[72vw]"
          style={{ textWrap: "balance" }}
        >
          A companion for grief, grounded in science.
        </h1>
        <p className="mt-[3.5vh] text-[3vw] text-muted max-w-[56vw] leading-relaxed">
          Trauma-informed support for continuing bonds and meaning after loss —
          there whenever grief feels heavy.
        </p>
        <div className="mt-[6vh] flex items-center gap-[2vw] text-[2.2vw] text-muted">
          <span className="text-teal font-medium">meaningbridge.replit.app</span>
          <span className="w-[5vw] h-px bg-line" />
          <span>Portland Institute for Loss and Transition</span>
        </div>
      </div>
    </div>
  );
}
