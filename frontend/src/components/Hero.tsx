import { useEffect, useRef, useState } from "react";

type Props = { sourceCount: number | null };

export default function Hero({ sourceCount }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    videoRef.current?.play().catch(() => {});
  }, [reduceMotion]);

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ height: "clamp(340px, 62vh, 620px)", background: "#070C14" }}
    >
      {/* ── Video ── */}
      {reduceMotion ? (
        <img
          src="/hero-poster.webp"
          alt="Exploded view of a Hirth two-stroke aviation engine"
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ opacity: 0.45 }}
        />
      ) : (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover object-center"
          src="/hero-engine.mp4"
          poster="/hero-poster.webp"
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          style={{ opacity: 0.45 }}
        />
      )}

      {/* ── Blueprint grid overlay ── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(56,120,200,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(56,120,200,0.055) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* ── Right-side navy glow — keeps video visible left/centre ── */}
      <div
        className="absolute inset-y-0 right-0 w-3/5"
        style={{
          background:
            "radial-gradient(ellipse 70% 70% at 80% 50%, rgba(23,60,110,0.42) 0%, transparent 70%)",
        }}
      />

      {/* ── Left-side gradient so text is always legible ── */}
      <div
        className="absolute inset-y-0 left-0 w-2/3"
        style={{
          background:
            "linear-gradient(to right, rgba(7,12,20,0.82) 0%, rgba(7,12,20,0.5) 60%, transparent 100%)",
        }}
      />

      {/* ── Top accent rule ── */}
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background:
            "linear-gradient(to right, transparent, #3878C8 20%, rgba(56,120,200,0.3) 60%, transparent)",
        }}
      />

      {/* ── Corner brackets ── */}
      <div
        className="absolute top-[18px] left-[18px] w-[18px] h-[18px]"
        style={{ borderTop: "1.5px solid #3878C8", borderLeft: "1.5px solid #3878C8" }}
      />
      <div
        className="absolute bottom-[18px] right-[18px] w-[18px] h-[18px]"
        style={{
          borderBottom: "1.5px solid rgba(56,120,200,0.35)",
          borderRight: "1.5px solid rgba(56,120,200,0.35)",
        }}
      />

      {/* ── Blueprint circles (right side) ── */}
      <svg
        className="absolute right-[-20px] top-1/2 -translate-y-1/2 pointer-events-none"
        width="300"
        height="300"
        viewBox="0 0 280 280"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="140" cy="140" r="130"
          stroke="#3878C8" strokeWidth="0.5" strokeDasharray="4 6"
          className="origin-center animate-spin-slow"
          style={{ transformOrigin: "140px 140px" }}
        />
        <circle cx="140" cy="140" r="90" stroke="#3878C8" strokeWidth="0.5" opacity="0.35" />
        <circle cx="140" cy="140" r="50" stroke="#3878C8" strokeWidth="1" opacity="0.22" />
        <circle cx="140" cy="140" r="8" fill="#3878C8" opacity="0.3" />
        <line x1="10" y1="140" x2="270" y2="140" stroke="#3878C8" strokeWidth="0.5" opacity="0.2" />
        <line x1="140" y1="10" x2="140" y2="270" stroke="#3878C8" strokeWidth="0.5" opacity="0.2" />
      </svg>

      {/* ── Vertical divider between text and stat ── */}
      <div
        className="absolute inset-y-0 hidden sm:block"
        style={{
          right: "200px",
          width: "0.5px",
          background:
            "linear-gradient(to bottom, transparent, rgba(56,120,200,0.12) 20%, rgba(56,120,200,0.12) 80%, transparent)",
        }}
      />

      {/* ── Main text ── */}
      <div className="relative h-full max-w-5xl mx-auto px-5 sm:px-10 flex items-center">
        <div className="animate-rise-in">
          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-px flex-shrink-0" style={{ background: "#3878C8" }} />
            <p
              className="font-mono text-[10px] tracking-[0.22em] uppercase"
              style={{ color: "#3878C8" }}
            >
              Two-stroke aviation engines
            </p>
          </div>

          {/* Stacked title */}
          <h1
            className="uppercase leading-[0.93] tracking-[-0.035em]"
            style={{ fontSize: "clamp(2.4rem, 6vw, 4rem)", fontWeight: 800 }}
          >
            <span
              className="block"
              style={{
                fontWeight: 300,
                color: "#7aa8e0",
                fontSize: "clamp(2.1rem, 5.5vw, 3.6rem)",
              }}
            >
              Hirth
            </span>
            <span className="block" style={{ color: "#3878C8" }}>
              Engine
            </span>
            <span className="block" style={{ color: "#EDF2FA" }}>
              Knowledge
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="mt-4 text-sm leading-relaxed max-w-xs"
            style={{ color: "rgba(56,120,200,0.45)" }}
          >
            Ask in English or German — answers grounded in indexed engineering sources.
          </p>
        </div>
      </div>

      {/* ── Chunk counter reticle ── */}
      {sourceCount !== null && (
        <div className="absolute right-6 sm:right-10 top-1/2 -translate-y-1/2 hidden sm:flex flex-col items-center justify-center">
          <div
            className="relative flex flex-col items-center justify-center"
            style={{
              width: 110,
              height: 110,
              borderRadius: "50%",
              border: "1px solid rgba(56,120,200,0.3)",
            }}
          >
            {/* inner ring */}
            <div
              className="absolute inset-[7px] rounded-full pointer-events-none"
              style={{ border: "0.5px solid rgba(56,120,200,0.15)" }}
            />
            {/* outer dashed ring */}
            <div
              className="absolute pointer-events-none"
              style={{
                inset: -8,
                borderRadius: "50%",
                border: "0.5px solid rgba(56,120,200,0.1)",
                borderTopColor: "rgba(56,120,200,0.4)",
              }}
            />
            <span
              className="font-mono leading-none tabular-nums"
              style={{ fontSize: 28, fontWeight: 400, color: "#3878C8", letterSpacing: "-0.02em" }}
            >
              {sourceCount.toLocaleString()}
            </span>
            <span
              className="font-mono text-center mt-1 leading-snug"
              style={{ fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e3a60" }}
            >
              chunks<br />indexed
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
