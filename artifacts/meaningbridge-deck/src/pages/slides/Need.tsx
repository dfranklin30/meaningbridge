export default function Need() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-cream font-body text-ink">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(46vw 46vw at 100% 0%, hsl(209 54% 26% / 0.08), transparent 60%)",
        }}
      />
      <div className="absolute inset-0 flex flex-col px-[8vw] py-[9vh]">
        <p className="text-[2.2vw] tracking-[0.32em] uppercase text-teal font-medium">
          The need
        </p>
        <h2
          className="font-display font-medium text-[5.2vw] leading-[1.05] text-navy max-w-[64vw] mt-[2vh]"
          style={{ textWrap: "balance" }}
        >
          Grief touches everyone. Support rarely lasts.
        </h2>

        <div className="grid grid-cols-3 gap-[4vw] mt-[8vh]">
          <div>
            <div className="font-display font-medium text-[7vw] leading-none text-teal">
              12.5M+
            </div>
            <div className="mt-[2vh] text-[2.4vw] leading-snug text-ink">
              newly bereaved Americans each year
            </div>
          </div>
          <div>
            <div className="font-display font-medium text-[7vw] leading-none text-navy">
              46%
            </div>
            <div className="mt-[2vh] text-[2.4vw] leading-snug text-ink">
              know where to turn for grief support
            </div>
          </div>
          <div>
            <div className="font-display font-medium text-[7vw] leading-none text-amber">
              3 months
            </div>
            <div className="mt-[2vh] text-[2.4vw] leading-snug text-ink">
              until everyday support quietly fades
            </div>
          </div>
        </div>

        <p className="mt-auto text-[2.2vw] text-muted max-w-[70vw]">
          Sources: CDC/NVSS 2024, Childhood Bereavement Estimation Model,
          national grief-support surveys.
        </p>
      </div>
    </div>
  );
}
