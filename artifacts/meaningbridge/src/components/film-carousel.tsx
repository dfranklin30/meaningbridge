import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import teaserFilm from "@/assets/teaser-film.mp4";

/**
 * The welcome film. Per Dr. Neimeyer's direction the former carousel of talks
 * is gone — one film greets visitors, and a couple of his more substantial
 * talks live quietly in the "About Dr. Neimeyer" section instead.
 *
 * The film starts with sound on. Browsers that block audible autoplay fall
 * back to muted playback, and the sound button lets the visitor turn it up.
 */
export function FilmCarousel() {
  const [soundOn, setSoundOn] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.volume = 0.7;
    const attempt = v.play();
    if (attempt) {
      attempt.catch(() => {
        // Autoplay with audio was blocked — play silently instead.
        v.muted = true;
        setSoundOn(false);
        void v.play().catch(() => {});
      });
    }
  }, []);

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !soundOn;
    v.muted = !next;
    if (next) {
      v.volume = 0.7;
      void v.play().catch(() => {});
    }
    setSoundOn(next);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-5xl mx-auto mt-24 md:mt-32"
      aria-label="A welcome film"
    >
      <div className="text-center max-w-2xl mx-auto space-y-3 mb-10">
        <p className="text-sm uppercase tracking-[0.25em] text-primary/80">
          See it in motion
        </p>
        <h2 className="font-serif text-3xl md:text-4xl tracking-tight">
          A closer look.
        </h2>
        <p className="text-muted-foreground">
          A short glimpse of what MeaningBridge feels like.
        </p>
      </div>

      <div className="relative rounded-3xl overflow-hidden border border-border bg-card shadow-[0_20px_60px_-20px_hsl(215_50%_30%/0.2)]">
        <div className="relative aspect-video bg-secondary/30">
          <video
            ref={videoRef}
            src={teaserFilm}
            autoPlay
            loop
            playsInline
            preload="auto"
            className="block w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={soundOn}
            aria-label={soundOn ? "Turn off sound" : "Play sound"}
            title={soundOn ? "Sound on" : "Play sound"}
            className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 backdrop-blur px-4 py-2 text-sm text-foreground/80 shadow-sm transition-colors hover:bg-background/90 hover:text-foreground"
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            {soundOn ? "Sound on" : "Play sound"}
          </button>
        </div>
      </div>
    </motion.section>
  );
}
