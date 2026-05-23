import { motion } from "framer-motion";
import sceneBonds from "@/assets/scene-bonds.png";
import sceneLoss from "@/assets/scene-loss.png";
import sceneTransformation from "@/assets/scene-transformation.png";
import sceneCompanion from "@/assets/scene-companion.png";

type Scene = {
  src: string;
  title: string;
  body: string;
  alt: string;
};

const SCENES: Scene[] = [
  {
    src: sceneBonds,
    title: "Bonds",
    body:
      "Family, friends, the animals who share our lives — the people and presences that shape who we love and who we are.",
    alt: "A multi-generational family seated together at sunset with a golden retriever resting nearby.",
  },
  {
    src: sceneLoss,
    title: "Loss",
    body:
      "An empty chair, a sleeping cat, a candle by the window. Absence is its own kind of presence.",
    alt: "A quiet room at dawn with an empty chair, a folded knit blanket, a small candle in the window, a sleeping cat on the rug, and a framed photograph nearby.",
  },
  {
    src: sceneTransformation,
    title: "Transformation",
    body:
      "Grief does not end. It changes. From what falls, something tender can rise — at its own pace, in its own time.",
    alt: "Autumn leaves swirling upward into a flock of birds against a sunrise, with a single green sprout rising from the dark soil.",
  },
  {
    src: sceneCompanion,
    title: "A companion alongside",
    body:
      "MeaningBridge sits beside you like soft light — a gentle presence, never a replacement for the people who love you or the clinicians who care for you.",
    alt: "A person seated on a wooden bench by a window with a sleeping dog at their feet, a teal wisp of light forming a soft infinity beside them as a quiet companion presence.",
  },
];

export function SceneGallery() {
  return (
    <div className="grid sm:grid-cols-2 gap-6 md:gap-8">
      {SCENES.map((scene, idx) => (
        <motion.figure
          key={scene.title}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{
            duration: 0.9,
            ease: [0.22, 1, 0.36, 1],
            delay: idx * 0.08,
          }}
          className="group"
        >
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-[0_20px_60px_-30px_hsl(215_50%_30%/0.25)]">
            <div className="aspect-[4/3] overflow-hidden">
              <img
                src={scene.src}
                alt={scene.alt}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.03]"
              />
            </div>
            {/* Soft wash at the bottom for legibility if we ever overlay text */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, transparent 60%, hsl(36 40% 98% / 0.4) 100%)",
              }}
            />
          </div>
          <figcaption className="mt-4 px-1">
            <h3 className="font-serif text-xl text-foreground tracking-tight">
              {scene.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              {scene.body}
            </p>
          </figcaption>
        </motion.figure>
      ))}
    </div>
  );
}
