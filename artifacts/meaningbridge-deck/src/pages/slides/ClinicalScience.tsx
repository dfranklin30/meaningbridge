export default function ClinicalScience() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-cream font-body text-ink">
      <div className="absolute inset-0 flex flex-col px-[8vw] py-[8vh]">
        <p className="text-[2.2vw] tracking-[0.32em] uppercase text-teal font-medium">
          The foundation
        </p>
        <h2 className="font-display font-medium text-[5vw] leading-[1.05] text-navy mt-[2vh]">
          Grounded in clinical science
        </h2>

        <div className="grid grid-cols-2 gap-[5vw] mt-[6vh] flex-1">
          <div className="flex flex-col justify-center">
            <p className="text-[2.6vw] leading-relaxed text-ink max-w-[38vw]">
              Built with Dr. Robert Neimeyer, a founder of the modern
              meaning-reconstruction field. A validated grief measure quietly
              guides the level of care — so support meets each person where they
              are.
            </p>
            <p className="mt-[3vh] text-[2.2vw] leading-relaxed text-muted max-w-[38vw]">
              We shift from numbers to narratives. You never see a score.
            </p>
          </div>

          <div className="flex flex-col justify-center gap-[3vh]">
            <div className="flex items-center gap-[2.5vw]">
              <span className="w-[3vw] h-[3vw] rounded-full bg-teal shrink-0" />
              <div>
                <div className="font-display font-medium text-[3vw] text-navy">
                  Universal
                </div>
                <div className="text-[2.2vw] text-muted">
                  Everyday support and reflection.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-[2.5vw]">
              <span className="w-[3vw] h-[3vw] rounded-full bg-navy shrink-0" />
              <div>
                <div className="font-display font-medium text-[3vw] text-navy">
                  Targeted
                </div>
                <div className="text-[2.2vw] text-muted">
                  Added structure for deeper grief.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-[2.5vw]">
              <span className="w-[3vw] h-[3vw] rounded-full bg-amber shrink-0" />
              <div>
                <div className="font-display font-medium text-[3vw] text-navy">
                  Clinical
                </div>
                <div className="text-[2.2vw] text-muted">
                  Connection to professional care.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
