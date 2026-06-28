import { useEffect, useRef, useState } from "react";

type Props = { sourceCount: number | null; scrollToChat?: () => void };

export default function Hero({ sourceCount, scrollToChat }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    videoRef.current?.play().catch(() => {
      /* autoplay can be blocked in some embedded contexts — poster covers this */
    });
  }, [reduceMotion]);

  return (
    <section className="relative w-full h-[58vh] min-h-[400px] max-h-[640px] overflow-hidden shrink-0">
      {reduceMotion ? (
        <img
          src="/hero-poster.webp"
          alt="Exploded view of a Hirth two-stroke aviation engine"
          className="absolute inset-0 w-full h-full object-cover scale-110"
        />
      ) : (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover scale-100"
          src="/hero-engine.mp4"
          poster="/hero-poster.webp"
          muted
          loop = {true}
          autoPlay 
          playsInline
          preload="auto"
          aria-hidden="true"
        />
      )}

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/45" />

        {/* Left vignette */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />

      <div className="relative h-full w-full px-10 flex flex-col justify-end pb-5">
        <div className="animate-rise-in motion-safe-only max-w-xl">
          <p className="font-mono text-[11px] tracking-[0.2em] text-[#a89880] uppercase mb-3">
            Two-Stroke Aviation Engines
          </p>
          <h1 className="text-4xl sm:text-5xl font-[750] tracking-tight leading-tight" style={{ color: "#f7f7f7" }}>
            HIRTH Document Intelligence
          </h1>
          <p className="text-base mt-3 max-w-md leading-relaxed" style={{ color: "#a89880" }}>
            AI-powered document retrieval for Hirth knowledge base.
          </p>
          {scrollToChat && (
            <button
              onClick={scrollToChat}
              className="mt-4 text-xs font-mono uppercase tracking-wide border border-[#c9b89a]/60 text-[#c9b89a] hover:bg-[#c9b89a] hover:text-black px-4 py-2 rounded-lg transition"
            >
              Start asking →
            </button>
          )}
        </div>

        {/* {sourceCount !== null && (
          <div className="absolute bottom-5 right-4 text-right">
            <div className="font-mono text-2xl text-accent leading-none tabular-nums">
              {sourceCount.toLocaleString()}
            </div>
            <div className="font-mono text-[10px] tracking-[0.15em] text-textdim uppercase mt-0.5">
              chunks indexed
            </div>
          </div>
        )} */}
      </div>
    </section>
  );
}
