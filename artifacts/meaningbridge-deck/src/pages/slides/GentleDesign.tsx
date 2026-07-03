export default function GentleDesign() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-cream font-body text-ink">
      <div className="absolute inset-0 grid grid-cols-2">
        <div className="flex flex-col justify-center pl-[8vw] pr-[4vw]">
          <p className="text-[2.2vw] tracking-[0.32em] uppercase text-teal font-medium">
            The ethos
          </p>
          <h2
            className="font-display font-medium text-[5.2vw] leading-[1.05] text-navy mt-[2vh]"
            style={{ textWrap: "balance" }}
          >
            Gentle by design
          </h2>
          <p className="mt-[3vh] text-[2.6vw] leading-relaxed text-muted max-w-[36vw]">
            Every screen is built to steady you — never to hook you.
          </p>
        </div>

        <div className="bg-wash flex flex-col justify-center gap-[4vh] pr-[8vw] pl-[5vw]">
          <div>
            <h3 className="font-display font-medium text-[3vw] text-navy">
              Trauma-informed and calm
            </h3>
            <p className="mt-[1vh] text-[2.2vw] leading-snug text-ink">
              No bright alarms, no urgency, no pressure.
            </p>
          </div>
          <div>
            <h3 className="font-display font-medium text-[3vw] text-navy">
              No gamification
            </h3>
            <p className="mt-[1vh] text-[2.2vw] leading-snug text-ink">
              No streaks, points, or nudges to perform.
            </p>
          </div>
          <div>
            <h3 className="font-display font-medium text-[3vw] text-navy">
              Crisis support, always near
            </h3>
            <p className="mt-[1vh] text-[2.2vw] leading-snug text-ink">
              One tap away on every single screen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
