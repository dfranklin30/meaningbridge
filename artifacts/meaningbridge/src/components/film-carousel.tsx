import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Volume2, VolumeX, Play } from "lucide-react";
import teaserFilm from "@/assets/teaser-film.mp4";
import heroFilm from "@/assets/hero-film.mp4";

type Clip =
  | { kind: "video"; title: string; caption: string; src: string }
  | { kind: "youtube"; title: string; caption: string; id: string };

const clips: Clip[] = [
  {
    kind: "video",
    title: "A thirty-second glimpse",
    caption: "What MeaningBridge feels like",
    src: teaserFilm,
  },
  {
    kind: "video",
    title: "A quiet welcome",
    caption: "The opening film",
    src: heroFilm,
  },
  {
    kind: "youtube",
    title: "The Three R's of Processing Grief",
    caption: "Retelling, rebuilding, reinventing",
    id: "G7Lm-Fo2UGw",
  },
  {
    kind: "youtube",
    title: "Finding Meaning in Grief",
    caption: "Dr. Robert Neimeyer, 2022",
    id: "6r28S6iZ3Yc",
  },
  {
    kind: "youtube",
    title: "Grief and the Quest for Meaning",
    caption: "Dr. Robert Neimeyer",
    id: "E1QBfAzc-VU",
  },
  {
    kind: "youtube",
    title: "Meaning Reconstruction",
    caption: "Models and theories of grief, 2023",
    id: "_gxymlx7MgA",
  },
  {
    kind: "youtube",
    title: "Meaning Making and Meaning Reconstruction",
    caption: "In conversation, 2023",
    id: "Vh_w4mGA_Ck",
  },
  {
    kind: "youtube",
    title: "On the Goal of Grief and How it Works",
    caption: "Dr. Robert Neimeyer",
    id: "VuAILCclSHA",
  },
  {
    kind: "youtube",
    title: "Grief Work and Secure Bases",
    caption: "Dr. Robert Neimeyer",
    id: "bBfrPaD78mQ",
  },
  {
    kind: "youtube",
    title: "The Six Tasks of Grief",
    caption: "Integrating loss into your life, 2024",
    id: "n9p5MgJlcXI",
  },
];

// How long each YouTube talk previews before the carousel moves on. Self-hosted
// films play to their natural end instead of using a timer.
const YT_PREVIEW_MS = 20000;

export function FilmCarousel() {
  const [active, setActive] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [ytPlaying, setYtPlaying] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const current = clips[active];

  const go = useCallback((next: number) => {
    setActive(((next % clips.length) + clips.length) % clips.length);
    setSoundOn(false);
    setYtPlaying(false);
  }, []);

  // While a viewer is hovering or listening with sound, the carousel waits.
  const paused = hovering || soundOn;

  // Respect reduced-motion: fall back to manual (click-to-play) navigation.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setAutoPlay(!mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Auto-start each YouTube talk when it becomes the active clip.
  useEffect(() => {
    if (autoPlay && current.kind === "youtube") setYtPlaying(true);
  }, [active, autoPlay, current.kind]);

  // Advance YouTube talks after a gentle preview; films advance on their own end.
  useEffect(() => {
    if (!autoPlay || paused || current.kind !== "youtube") return;
    const t = setTimeout(() => go(active + 1), YT_PREVIEW_MS);
    return () => clearTimeout(t);
  }, [active, autoPlay, paused, current.kind, go]);

  // Browsers block autoplay with sound, so self-hosted films start muted and the
  // visitor gently turns sound on.
  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !soundOn;
    v.muted = !next;
    if (next) {
      v.volume = 0.55;
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
      aria-roledescription="carousel"
      aria-label="MeaningBridge films and Dr. Neimeyer's talks"
    >
      <div className="text-center max-w-2xl mx-auto space-y-3 mb-10">
        <p className="text-sm uppercase tracking-[0.25em] text-primary/80">
          See it in motion
        </p>
        <h2 className="font-serif text-3xl md:text-4xl tracking-tight">
          A closer look.
        </h2>
        <p className="text-muted-foreground">
          A short glimpse of MeaningBridge, alongside talks from Dr. Robert
          Neimeyer on grief and the reconstruction of meaning.
        </p>
      </div>

      {/* Main stage */}
      <div
        className="relative rounded-3xl overflow-hidden border border-border bg-card shadow-[0_20px_60px_-20px_hsl(215_50%_30%/0.2)]"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="relative aspect-video bg-secondary/30">
          {current.kind === "video" ? (
            <>
              <video
                key={`v-${active}`}
                ref={videoRef}
                src={current.src}
                autoPlay
                muted
                loop={paused || !autoPlay}
                playsInline
                preload="auto"
                onEnded={() => {
                  if (autoPlay && !paused) go(active + 1);
                }}
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
            </>
          ) : ytPlaying ? (
            <iframe
              key={`yt-${active}`}
              src={`https://www.youtube-nocookie.com/embed/${current.id}?autoplay=1&mute=1&rel=0`}
              title={current.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="block w-full h-full"
            />
          ) : (
            <button
              type="button"
              onClick={() => setYtPlaying(true)}
              aria-label={`Play: ${current.title}`}
              className="group absolute inset-0 block w-full h-full"
            >
              <img
                src={`https://img.youtube.com/vi/${current.id}/hqdefault.jpg`}
                alt={current.title}
                crossOrigin="anonymous"
                className="w-full h-full object-cover"
              />
              <span className="absolute inset-0 bg-brand-navy/30 transition-colors group-hover:bg-brand-navy/20" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background/85 backdrop-blur text-primary shadow-lg transition-transform duration-300 group-hover:scale-105">
                  <Play className="w-6 h-6 translate-x-0.5" />
                </span>
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Active clip title + navigation */}
      <div className="flex items-center justify-between gap-4 mt-5">
        <button
          type="button"
          onClick={() => go(active - 1)}
          aria-label="Previous clip"
          className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full border border-border bg-card/70 backdrop-blur text-foreground/70 hover:text-foreground hover:border-primary/40 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center min-w-0">
          <p className="font-serif text-lg md:text-xl tracking-tight truncate">
            {current.title}
          </p>
          <p className="text-sm text-muted-foreground truncate">{current.caption}</p>
        </div>
        <button
          type="button"
          onClick={() => go(active + 1)}
          aria-label="Next clip"
          className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full border border-border bg-card/70 backdrop-blur text-foreground/70 hover:text-foreground hover:border-primary/40 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Thumbnail rail */}
      <div className="mt-6 flex gap-3 overflow-x-auto pb-2 snap-x">
        {clips.map((clip, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={`View: ${clip.title}`}
            aria-current={i === active}
            className={`group relative shrink-0 snap-start w-40 aspect-video rounded-xl overflow-hidden border transition-colors ${
              i === active
                ? "border-primary ring-2 ring-primary/30"
                : "border-border hover:border-primary/40"
            }`}
          >
            {clip.kind === "youtube" ? (
              <img
                src={`https://img.youtube.com/vi/${clip.id}/hqdefault.jpg`}
                alt={clip.title}
                crossOrigin="anonymous"
                loading="lazy"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="absolute inset-0 bg-gradient-to-br from-brand-navy/90 via-brand-navy/70 to-brand-teal/70" />
            )}
            <span className="absolute inset-0 bg-brand-navy/20 group-hover:bg-brand-navy/10 transition-colors" />
            <span className="absolute inset-x-0 bottom-0 p-2 text-left">
              <span className="block text-[0.7rem] leading-tight font-medium text-white line-clamp-2 [text-shadow:0_1px_3px_rgb(0_0_0/0.6)]">
                {clip.title}
              </span>
            </span>
            <span className="absolute top-2 right-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-background/85 text-primary shadow-sm">
              <Play className="w-3 h-3 translate-x-px" />
            </span>
          </button>
        ))}
      </div>
    </motion.section>
  );
}
