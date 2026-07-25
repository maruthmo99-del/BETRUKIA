import { useEffect, useRef, useState } from "react";
import { useGameSocket } from "../hooks/useGameSocket.js";

const WIDTH = 420;
const HEIGHT = 240;
const PAD_X = 24;
const PAD_Y = 28;
const BASE_MAX_M = 3;
const LOG_HEADROOM = 0.55;
const EASE_RATE = 2.4;

// A live, unauthenticated read of whatever round is actually in progress on
// the server right now. This is the hero's signature: real gameplay data,
// not a decorative stock illustration.
export default function LiveCurvePreview() {
  const { phase, multiplier, lastCrash } = useGameSocket(null, null);
  const [trail, setTrail] = useState([]);
  const scaleRef = useRef({ logMaxM: Math.log(BASE_MAX_M), lastTs: null });

  useEffect(() => {
    if (phase === "waiting") {
      setTrail([]);
      scaleRef.current = { logMaxM: Math.log(BASE_MAX_M), lastTs: null };
    } else if (phase === "flying") setTrail((t) => [...t, multiplier].slice(-160));
  }, [multiplier, phase]);

  // Eased logarithmic vertical scale — same fix as the main game graph:
  // a linear scale would squash the 1x->20x climb flat once a round gets
  // high, making the start of the curve invisible. Log scale keeps every
  // stage of the climb visible no matter how high it goes.
  const rawMaxM = Math.max(1.01, multiplier, ...trail);
  const targetLogMaxM = Math.max(Math.log(BASE_MAX_M), Math.log(rawMaxM) + LOG_HEADROOM);
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const prevScale = scaleRef.current;
  const dt = prevScale.lastTs ? Math.min(0.12, (now - prevScale.lastTs) / 1000) : 0;
  const ease = 1 - Math.exp(-EASE_RATE * dt);
  const logMaxM = Math.max(Math.log(rawMaxM), prevScale.logMaxM + (targetLogMaxM - prevScale.logMaxM) * ease);
  scaleRef.current = { logMaxM, lastTs: now };

  const toPoint = (m, i, len) => {
    const x = len <= 1 ? PAD_X : PAD_X + (i / (len - 1)) * (WIDTH - PAD_X * 2);
    const logM = Math.log(Math.max(1, m));
    const y = HEIGHT - PAD_Y - (logM / (logMaxM || 1)) * (HEIGHT - PAD_Y * 2);
    return [x, y];
  };

  const points = trail.map((m, i) => toPoint(m, i, trail.length));
  const pathD = points.length > 1 ? "M " + points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ") : "";
  const tip = points[points.length - 1];

  // Rough climb angle for the plane marker, from the last couple of points.
  let angle = -28;
  if (points.length > 3) {
    const [x1, y1] = points[points.length - 4];
    const [x2, y2] = points[points.length - 1];
    angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  }

  const statusLabel =
    phase === "waiting" ? "Next round boarding…" : phase === "flying" ? "Live now" : "Crashed";
  const displayValue =
    phase === "crashed" && lastCrash ? (lastCrash.crashPoint / 100).toFixed(2) : multiplier.toFixed(2);

  return (
    <div className={`curve-card curve-card--${phase}`}>
      <div className="curve-card-top">
        <span className={`curve-status-dot curve-status-dot--${phase}`} />
        <span className="curve-status-label">{statusLabel}</span>
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="curve-svg" preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={WIDTH} y1={HEIGHT * f} y2={HEIGHT * f} className="curve-grid-line" />
        ))}

        {phase === "flying" && pathD && (
          <path d={pathD} fill="none" className="curve-path" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {phase === "flying" && tip && (
          <g transform={`translate(${tip[0]}, ${tip[1]}) rotate(${angle})`}>
            <path d="M -10 4 L 12 0 L -10 -4 L -5 0 Z" className="curve-plane" />
          </g>
        )}

        {phase === "crashed" && (
          <text x={WIDTH / 2} y={HEIGHT / 2} textAnchor="middle" className="curve-crash-text">
            ✕
          </text>
        )}
      </svg>

      <div className="curve-readout">
        <span className="curve-value">{displayValue}x</span>
      </div>
    </div>
  );
}