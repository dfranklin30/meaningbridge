export default function Professionals() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-cream font-body text-ink">
      <div className="absolute inset-0 grid grid-cols-5">
        <div className="col-span-2 flex flex-col justify-center pl-[8vw] pr-[3vw]">
          <p className="text-[2.2vw] tracking-[0.32em] uppercase text-navy font-medium">
            For professionals
          </p>
          <h2
            className="font-display font-medium text-[4.6vw] leading-[1.06] text-navy mt-[2vh]"
            style={{ textWrap: "balance" }}
          >
            A bridge for care teams
          </h2>
          <p className="mt-[3vh] text-[2.4vw] leading-relaxed text-muted">
            Extend your care between sessions, for grief counselors and clinics.
          </p>
        </div>

        <div
          className="col-span-3 flex flex-col justify-center gap-[3.4vh] pl-[5vw] pr-[8vw]"
          style={{ background: "hsl(209 54% 26% / 0.06)" }}
        >
          <div className="flex items-baseline gap-[1.8vw]">
            <span className="text-teal text-[2.6vw]">—</span>
            <p className="text-[2.4vw] leading-snug text-ink">
              A consented patient roster with{" "}
              <span className="whitespace-nowrap">care-tier badges</span>
            </p>
          </div>
          <div className="flex items-baseline gap-[1.8vw]">
            <span className="text-teal text-[2.6vw]">—</span>
            <p className="text-[2.4vw] leading-snug text-ink">
              Engagement signals, not eavesdropping
            </p>
          </div>
          <div className="flex items-baseline gap-[1.8vw]">
            <span className="text-teal text-[2.6vw]">—</span>
            <p className="text-[2.4vw] leading-snug text-ink">
              Calm safety flags when someone needs more
            </p>
          </div>
          <div className="flex items-baseline gap-[1.8vw]">
            <span className="text-teal text-[2.6vw]">—</span>
            <p className="text-[2.4vw] leading-snug text-ink">
              Referrals and a trusted provider directory
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
