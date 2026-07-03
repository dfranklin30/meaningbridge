export default function Philosophy() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-cream font-body text-ink">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60vw 60vw at 15% 90%, hsl(176 58% 33% / 0.12), transparent 60%)",
        }}
      />
      <svg
        className="absolute right-[6vw] top-[10vh] w-[26vw] opacity-[0.10]"
        viewBox="0 0 300 200"
        fill="none"
      >
        <path
          d="M60 100 C60 55 130 55 150 100 C170 145 240 145 240 100 C240 55 170 55 150 100 C130 145 60 145 60 100 Z"
          stroke="hsl(209 54% 26%)"
          strokeWidth="2.5"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col justify-center px-[9vw]">
        <blockquote
          className="font-display font-normal text-[5.6vw] leading-[1.12] text-navy max-w-[76vw]"
          style={{ textWrap: "balance" }}
        >
          Grief is not a problem to solve. It is a bond to carry forward.
        </blockquote>
        <p className="mt-[5vh] text-[2.5vw] text-muted max-w-[60vw] leading-relaxed">
          The MeaningBridge approach, drawn from the life's work of Dr. Robert
          Neimeyer.
        </p>
      </div>
    </div>
  );
}
