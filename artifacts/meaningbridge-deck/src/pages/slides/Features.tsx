export default function Features() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-cream font-body text-ink">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(44vw 44vw at 96% 96%, hsl(176 58% 33% / 0.09), transparent 60%)",
        }}
      />
      <div className="absolute inset-0 flex flex-col px-[8vw] py-[8vh]">
        <h2 className="font-display font-medium text-[5vw] leading-[1.05] text-navy">
          Ways to tend to your grief
        </h2>

        <div className="grid grid-cols-3 gap-x-[3.5vw] gap-y-[4vh] mt-[6vh]">
          <div>
            <h3 className="font-display font-medium text-[2.9vw] text-teal">
              Guided journaling
            </h3>
            <p className="mt-[1.2vh] text-[2.3vw] leading-snug text-muted">
              Prompts that meet you where you are.
            </p>
          </div>
          <div>
            <h3 className="font-display font-medium text-[2.9vw] text-teal">
              Voice entries
            </h3>
            <p className="mt-[1.2vh] text-[2.3vw] leading-snug text-muted">
              Speak when writing feels like too much.
            </p>
          </div>
          <div>
            <h3 className="font-display font-medium text-[2.9vw] text-teal">
              Self-guided practices
            </h3>
            <p className="mt-[1.2vh] text-[2.3vw] leading-snug text-muted">
              Breathwork and gentle reflection.
            </p>
          </div>
          <div>
            <h3 className="font-display font-medium text-[2.9vw] text-teal">
              Reflective inventories
            </h3>
            <p className="mt-[1.2vh] text-[2.3vw] leading-snug text-muted">
              See your grief with more clarity.
            </p>
          </div>
          <div>
            <h3 className="font-display font-medium text-[2.9vw] text-teal">
              A profile of your loved one
            </h3>
            <p className="mt-[1.2vh] text-[2.3vw] leading-snug text-muted">
              Hold their memory and photos close.
            </p>
          </div>
          <div>
            <h3 className="font-display font-medium text-[2.9vw] text-teal">
              Insights over time
            </h3>
            <p className="mt-[1.2vh] text-[2.3vw] leading-snug text-muted">
              Notice how you are slowly changing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
