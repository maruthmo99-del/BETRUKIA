import React, { useEffect, useRef, useState } from "react";
import PlaneIcon from "./PlaneIcon.jsx";
import { createStars, renderFlightFrame } from "../curve/flightCanvas.js";

// Spinning ray backdrop behind the curve, generated once as plain SVG lines
function BurstShell() {
  const rayCount = 16;
  const rays = Array.from({ length: rayCount }, (_, i) => {
    const angle = (360 / rayCount) * i;
    return <line key={i} x1="200" y1="200" x2="200" y2="-40" transform={`rotate(${angle} 200 200)`} />;
  });
  return (
    <svg className="burst-shell absolute inset-0 w-full h-full pointer-events-none opacity-20" viewBox="0 0 400 400" preserveAspectRatio="none" aria-hidden="true">
      {rays}
    </svg>
  );
}

// The actual flight graph: fully updated to resize fluidly on mobile, tablet, and desktop viewports
function FlightGraph({ phase, flightStartTime, finalCrashMultiplier, multiplier, lastCrash }) {
  const canvasRef = useRef(null);
  const starsRef = useRef(createStars());
  const stateRef = useRef({ phase, flightStartTime, finalCrashMultiplier, multiplier, lastCrash });

  // Keep the render loop's view of props current without tearing the loop down
  stateRef.current = { phase, flightStartTime, finalCrashMultiplier, multiplier, lastCrash };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let raf;

    const render = (now) => {
      const { phase, flightStartTime, finalCrashMultiplier } = stateRef.current;
      const ctx = canvas.getContext("2d");

      // DYNAMIC MOBILE AUTO-RESIZE: Replace external utility to support responsive CSS boxes
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetW = rect.width;
      const targetH = rect.height;

      // Force-adjust internal dimensions to handle crisp retina sizing on mobile phone viewports
      if (canvas.width !== targetW * dpr || canvas.height !== targetH * dpr) {
        canvas.width = targetW * dpr;
        canvas.height = targetH * dpr;
        ctx.scale(dpr, dpr);
      }

      renderFlightFrame(ctx, targetW, targetH, {
        phase,
        flightStartTime,
        finalCrashMultiplier,
        now,
        stars: starsRef.current,
      });

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`graph-canvas w-full h-full block absolute inset-0 ${phase === "waiting" ? "is-waiting" : ""} ${phase === "crashed" ? "is-crashed" : ""}`}
    />
  );
}

// Boarding countdown: ticks locally to update progress bars fluidly
function BoardingCountdown({ waitMs, waitStartedAt }) {
  const [now, setNow] = useState(Date.now());
  const rafRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [waitStartedAt]);

  if (!waitStartedAt || !waitMs) {
    return <div className="waiting-label text-sm sm:text-base font-medium opacity-80 text-white/80">Place your bet — next round boarding…</div>;
  }

  const elapsed = Math.min(waitMs, Math.max(0, now - waitStartedAt));
  const remainingMs = waitMs - elapsed;
  const progress = elapsed / waitMs; 
  const secondsLeft = Math.max(0, Math.ceil(remainingMs / 1000));

  return (
    <div className="boarding-panel flex flex-col items-center justify-center w-full max-w-[280px] sm:max-w-md px-4">
      <div className="waiting-label text-xs sm:text-base font-medium text-white/80 text-center mb-1">Place your bet — next round boarding…</div>
      <div className="boarding-countdown text-sm sm:text-lg font-bold text-[#ff334b] text-center mb-3">Next round in {secondsLeft}s</div>
      <div className="boarding-track w-full h-2 bg-black/40 rounded-full relative overflow-visible border border-white/5">
        <div className="boarding-track-fill h-full bg-[#ff334b] rounded-full transition-all duration-75" style={{ width: `${progress * 100}%` }} />
        <div className="boarding-plane absolute -top-2 transform -translate-x-1/2 transition-all duration-75 text-[#ff334b]" style={{ left: `${progress * 100}%` }}>
          <PlaneIcon rotation={0} size={22} />
        </div>
      </div>
    </div>
  );
}

export function MultiplierDisplay({
  phase = "waiting",
  multiplier = 1.0,
  lastCrash,
  seedHash,
  waitMs,
  waitStartedAt,
  flightStartTime,
  finalCrashMultiplier,
}) {
  const milestone = phase === "flying" && multiplier >= 10;

  return (
    /* RESPONSIVE: Dynamic box heights (h-[42vh] scaling to h-[500px] on layout widths) to fit perfectly across viewports */
    <div className={`multiplier-stage relative w-full h-[42vh] sm:h-[48vh] md:h-[450px] lg:h-[500px] bg-[#0d0914] rounded-xl overflow-hidden border border-[#23173a] shadow-2xl flex flex-col justify-between p-3 select-none ${phase}`}>
      <BurstShell />

      <div className="multiplier-core w-full h-full relative flex items-center justify-center flex-1">
        <FlightGraph
          phase={phase}
          flightStartTime={flightStartTime}
          finalCrashMultiplier={finalCrashMultiplier}
          multiplier={multiplier}
          lastCrash={lastCrash}
        />

        {/* RESPONSIVE text scale adjustments (text-5xl for phone viewports up to text-8xl on high resolution screens) */}
        <div className={`multiplier-value z-10 flex flex-col items-center justify-center text-center pointer-events-none absolute inset-0 ${phase} ${milestone ? "gold-milestone" : ""}`}>
          {phase === "waiting" && <BoardingCountdown waitMs={waitMs} waitStartedAt={waitStartedAt} />}

          {phase === "flying" && (
            <span className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white tracking-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]">
              {multiplier.toFixed(2)}x
            </span>
          )}

          {phase === "crashed" && lastCrash && (
            <div className="flex flex-col items-center justify-center scale-90 sm:scale-100 animate-pulse">
              <div className="crash-label text-sm sm:text-xl font-black uppercase tracking-wider text-[#ff334b] bg-black/60 px-4 py-1.5 rounded-md border border-[#ff334b]/20 mb-2 shadow-lg">
                FLEW AWAY!
              </div>
              <span className="text-5xl sm:text-6xl md:text-7xl font-black text-[#ff334b] drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]">
                {(lastCrash.crashPoint / 100).toFixed(2)}x
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Responsive bottom status deck */}
      <div className="fairness-line z-10 w-full text-center text-[10px] sm:text-xs text-white/40 font-mono tracking-tight bg-black/20 py-1 rounded border border-white/5 backdrop-blur-sm truncate px-2">
        {phase === "waiting" && seedHash && (
          <span title={seedHash}>Round hash committed: {seedHash.slice(0, 12)}…</span>
        )}
        {phase === "crashed" && lastCrash && (
          <span title={lastCrash.serverSeed}>
            Seed revealed: {lastCrash.serverSeed.slice(0, 12)}… (verify anytime)
          </span>
        )}
      </div>
    </div>
  );
}

// Explicit export binding definition to prevent Vite bundler import discrepancies
export default MultiplierDisplay;
