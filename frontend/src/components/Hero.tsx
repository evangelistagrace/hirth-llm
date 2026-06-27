import { useEffect, useRef, useState } from "react";

type Props = { sourceCount: number | null };

export default function Hero({ sourceCount }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    // Play once on mount; the element naturally holds its final frame
    // (the fully exploded parts diagram) once playback ends — no loop.
    videoRef.current?.play().catch(() => {
      /* autoplay can be blocked in some embedded contexts — poster covers this */
    });
  }, [reduceMotion]);

  return (
    <section className="relative w-full h-[70vh] overflow-hidden">
      {reduceMotion ? (
        <img
          src="/hero-poster.webp"
          alt="Exploded view of a Hirth two-stroke aviation engine"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
          <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover object-[80%_center]"
          src="/hero-engine.mp4"
          poster="/hero-poster.webp"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
        />
      )}

      {/* Grounding gradient so overlaid text stays legible regardless of where parts land */}
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-bg/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg/70 via-transparent to-bg/40" />

      <div className="relative h-full max-w-7xl mx-auto pl-8 pr-16 flex flex-col justify-center">
        <div className="animate-rise-in motion-safe-only">
          <p className="font-mono text-[11px] tracking-[0.2em] text-accent2 uppercase mb-2">
            Two-Stroke Aviation Engines
          </p>
          <h1 className="leading-[0.9] font-bold uppercase">
            <span className="block text-[55px] sm:text-[70px] font-light text-[#8BB7FF]">
              HIRTH
            </span>

            <span className="block text-[55px] sm:text-[70px] font-extrabold text-[#3D84E6]">
              ENGINE
            </span>

            <span className="block text-[40px] sm:text-[56px] font-extrabold text-white">
              KNOWLEDGE
            </span>
          </h1>
          <p className="text-sm text-textdim mt-2 max-w-md">
            AI-powered document retrieval for Hirth knowledge base
          </p>
        </div>

        {/* {sourceCount !== null && (
          <div className="absolute bottom-5 right-4 text-right">
            <div className="font-mono text-2xl text-data leading-none tabular-nums">
              {sourceCount.toLocaleString()}
            </div>
            <div className="font-mono text-[10px] tracking-[0.15em] text-textdim uppercase mt-0.5">
              
            </div>
          </div>
        )} */}
      </div>
    </section>
  );
}
