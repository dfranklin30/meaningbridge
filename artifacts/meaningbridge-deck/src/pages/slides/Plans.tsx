export default function Plans() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-cream font-body text-ink">
      <div className="absolute inset-0 flex flex-col px-[8vw] py-[8vh]">
        <h2
          className="font-display font-medium text-[4.8vw] leading-[1.05] text-navy max-w-[70vw]"
          style={{ textWrap: "balance" }}
        >
          Plans that follow need, not engagement
        </h2>

        <div className="grid grid-cols-3 gap-[3vw] mt-[7vh] flex-1">
          <div className="bg-card border border-line rounded-2xl p-[3vw] flex flex-col">
            <h3 className="font-display font-medium text-[3.4vw] text-teal">
              Companion
            </h3>
            <div className="w-[6vw] h-px bg-line my-[2.5vh]" />
            <p className="text-[2.2vw] leading-relaxed text-ink">
              Everyday support for continuing bonds and reflection.
            </p>
          </div>
          <div className="bg-card border border-line rounded-2xl p-[3vw] flex flex-col">
            <h3 className="font-display font-medium text-[3.4vw] text-navy">
              Enhanced
            </h3>
            <div className="w-[6vw] h-px bg-line my-[2.5vh]" />
            <p className="text-[2.2vw] leading-relaxed text-ink">
              Added structure for deeper or longer grief.
            </p>
          </div>
          <div className="bg-card border border-line rounded-2xl p-[3vw] flex flex-col">
            <h3 className="font-display font-medium text-[3.4vw] text-amber">
              Specialist
            </h3>
            <div className="w-[6vw] h-px bg-line my-[2.5vh]" />
            <p className="text-[2.2vw] leading-relaxed text-ink">
              Connected, professional-supported care.
            </p>
          </div>
        </div>

        <p className="mt-[5vh] text-[2.2vw] text-muted">
          Tiers mirror the level of care. Pricing shared at launch.
        </p>
      </div>
    </div>
  );
}
