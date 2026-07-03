export default function Companions() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-cream font-body text-ink">
      <div className="absolute inset-0 flex flex-col px-[8vw] py-[9vh]">
        <p className="text-[2.2vw] tracking-[0.32em] uppercase text-teal font-medium">
          The companions
        </p>
        <h2 className="font-display font-medium text-[5.2vw] leading-[1.05] text-navy mt-[2vh]">
          Two companions, two paths
        </h2>

        <div className="grid grid-cols-2 gap-[3vw] mt-[6vh] flex-1">
          <div className="bg-card border border-line rounded-2xl p-[3.2vw] flex flex-col">
            <div className="w-[7vw] h-[0.5vh] bg-teal rounded-full" />
            <h3 className="font-display font-medium text-[3.6vw] text-teal mt-[3vh]">
              Continuing Bonds
            </h3>
            <p className="mt-[2.5vh] text-[2.5vw] leading-relaxed text-ink">
              Stay connected to the person you lost — through memory, ritual, and
              conversation that keeps the relationship alive in a way that
              sustains you.
            </p>
          </div>
          <div className="bg-card border border-line rounded-2xl p-[3.2vw] flex flex-col">
            <div className="w-[7vw] h-[0.5vh] bg-navy rounded-full" />
            <h3 className="font-display font-medium text-[3.6vw] text-navy mt-[3vh]">
              Meaning Reconstruction
            </h3>
            <p className="mt-[2.5vh] text-[2.5vw] leading-relaxed text-ink">
              Make sense of life after loss — your story, your identity, and what
              matters now — moving at your own pace, never rushed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
