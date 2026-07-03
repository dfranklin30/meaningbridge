import { motion } from "framer-motion";
import photoBonds from "@/assets/photo-bonds.png";
import photoLoss from "@/assets/photo-loss.png";
import photoTransformation from "@/assets/photo-transformation.png";
import photoCompanion from "@/assets/photo-companion.png";

type Scene = {
  src: string;
  title: string;
  body: string;
  alt: string;
  /** Ken Burns direction — keyframes for transform-origin */
  origin: string;
  /** scale keyframes [from, to] */
  scale: [number, number];
};

const SCENES: Scene[] = [
  {
    src: photoBonds,
    title: "Bonds",
    body:
      "The people who love us — family, partners, friends — shape who we are. Those bonds do not end.",
    alt: "An older Black woman and a younger Black adult woman sitting close on a couch in soft window light, the younger woman's head gently resting on the older woman's shoulder, hands intertwined.",
    origin: "30% 40%",
    scale: [1.02, 1.08],
  },
  {
    src: photoLoss,
    title: "Loss",
    body:
      "A framed photograph, a warm cup, morning light. Absence is its own kind of presence.",
    alt: "A man seated by a tall window in warm morning light, looking gently toward the window with a small framed photograph and a steaming cup of tea on the side table beside him.",
    origin: "60% 50%",
    scale: [1.04, 1.0],
  },
  {
    src: photoTransformation,
    title: "Transformation",
    body:
      "Grief does not end. It changes. From what falls, something tender can rise — at its own pace.",
    alt: "Two adult hands gently cupping a small green seedling growing from rich dark soil, bathed in soft golden morning light.",
    origin: "50% 55%",
    scale: [1.02, 1.1],
  },
  {
    src: photoCompanion,
    title: "A companion alongside",
    body:
      "MeaningBridge sits beside you like soft light — a gentle presence, never a replacement for the people who love you or the clinicians who care for you.",
    alt: "An East Asian woman seated in a sunlit window nook holding a warm mug, eyes softly closed, with a golden retriever resting peacefully at her feet.",
    origin: "40% 45%",
    scale: [1.05, 1.0],
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
            duration: 1.1,
            ease: [0.22, 1, 0.36, 1],
            delay: idx * 0.1,
          }}
          className="group"
        >
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-[0_20px_60px_-30px_hsl(215_50%_30%/0.3)]">
            <div className="aspect-[4/3] overflow-hidden">
              {/* Ken Burns slow zoom + subtle drift */}
              <motion.img
                src={scene.src}
                alt={scene.alt}
                loading="lazy"
                className="w-full h-full object-cover"
                style={{ transformOrigin: scene.origin }}
                initial={{ scale: scene.scale[0] }}
                animate={{ scale: [scene.scale[0], scene.scale[1], scene.scale[0]] }}
                transition={{
                  duration: 18 + idx * 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>
            {/* Soft inner vignette to settle the image into the page */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse at center, transparent 55%, hsl(215 30% 15% / 0.12) 100%)",
              }}
            />
            {/* Top-left title chip that softly appears on hover */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
              style={{
                background:
                  "linear-gradient(to top, hsl(215 40% 12% / 0.55), transparent)",
              }}
            >
              <span className="text-white/95 font-serif text-lg tracking-tight">
                {scene.title}
              </span>
            </div>
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
