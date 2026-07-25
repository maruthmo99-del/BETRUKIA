// ======================================================
// flightCanvas.js
// Canvas renderer matching the reference AviatorCurve component:
// - curve/rocket start exactly at 1.00x (bottom-left)
// - curve auto-rescales to elapsed time / current multiplier so it
//   always fits the box, instead of following a fixed-shape path
// - rocket rotation is the real atan2 slope of the live curve
// - starfield + purple radial backdrop, red glow trail
//
// This is driven entirely by real game state (phase, flightStartTime,
// finalCrashMultiplier) coming from useGameSocket. The curve itself is
// generated analytically from the same exponential growth formula the
// backend uses, sampled densely every frame — not from the sparse,
// hundredths-rounded tick history — so it's always smooth and always
// starts exactly at the origin.
// ======================================================

const STAR_COUNT = 90;

// Must match backend/src/game/roundManager.js GROWTH exactly — the curve is
// generated analytically from this formula instead of from the sparse,
// hundredths-rounded tick history, which is what was causing the
// flat/kinked "staircase" segments near the origin.
const GROWTH = 0.00012;
const CURVE_SAMPLES = 320;
const CURVE_TENSION = 1.0;

function elapsedMsForMultiplier(multiplier) {
  return Math.log(Math.max(multiplier, 1)) / GROWTH;
}

// Densely re-samples the true exponential curve from t=0 up to the current
// elapsed time, so the shape is always smooth and always starts at exactly
// (t=0, multiplier=1) — no matter how sparse or jittery the real tick
// broadcasts are.
function buildAnalyticHistory(elapsedMs) {
  const clamped = Math.max(0, elapsedMs);
  const history = [];
  for (let i = 0; i <= CURVE_SAMPLES; i++) {
    const t = (clamped * i) / CURVE_SAMPLES;
    history.push({ t: t / 1000, multiplier: Math.exp(GROWTH * t) });
  }
  return history;
}

// Catmull-Rom -> cubic bezier conversion. The path will always begin exactly
// at the first sample and end exactly at the final sample, while still
// producing a polished, gently rising curve for the plane.
function drawSmoothPath(ctx, pts, tension = 1) {
  if (pts.length === 0) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 1) return;
  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
    return;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
}

const planeImage = new Image();
planeImage.src =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="250" height="110" viewBox="0 0 250 110">
  <defs>
    <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ff6b52"/>
      <stop offset="45%" stop-color="#e8321a"/>
      <stop offset="100%" stop-color="#a11c0d"/>
    </linearGradient>
    <linearGradient id="wingGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ff5a3f"/>
      <stop offset="100%" stop-color="#c22410"/>
    </linearGradient>
    <radialGradient id="hubGrad" cx="0.4" cy="0.35" r="0.7">
      <stop offset="0%" stop-color="#f4f6f8"/>
      <stop offset="55%" stop-color="#aab4bd"/>
      <stop offset="100%" stop-color="#5c6670"/>
    </radialGradient>
    <radialGradient id="propBlur" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#e9edf1" stop-opacity="0.55"/>
      <stop offset="70%" stop-color="#c7ced4" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#c7ced4" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="M18 55 L4 30 L14 30 L28 52 Z" fill="url(#bodyGrad)" stroke="#7a1508" stroke-width="1"/>
  <path d="M18 58 L2 74 L10 76 L24 60 Z" fill="url(#bodyGrad)" stroke="#7a1508" stroke-width="1"/>
  <path d="M60 78 L172 66 L182 74 L64 90 Z" fill="url(#wingGrad)" stroke="#7a1508" stroke-width="1.2"/>
  <path d="M22 52 C 22 40, 40 32, 70 31 L 180 40 C 205 42, 214 48, 222 53 C 214 58, 205 63, 180 65 L 70 70 C 40 69, 22 62, 22 52 Z" fill="url(#bodyGrad)" stroke="#7a1508" stroke-width="1.4"/>
  <ellipse cx="118" cy="45" rx="12" ry="8" fill="#bfe8ff" stroke="#5c0e05" stroke-width="1.2"/>
  <ellipse cx="118" cy="45" rx="12" ry="8" fill="#ffffff" opacity="0.15"/>
  <path d="M40 40 L190 47" stroke="#7a1508" stroke-width="1" opacity="0.5"/>
  <path d="M56 28 L170 18 L180 26 L60 38 Z" fill="url(#wingGrad)" stroke="#7a1508" stroke-width="1.2"/>
  <line x1="98" y1="70" x2="92" y2="94" stroke="#7a1508" stroke-width="3"/>
  <line x1="150" y1="66" x2="156" y2="92" stroke="#7a1508" stroke-width="3"/>
  <circle cx="90" cy="98" r="8" fill="#241c1a" stroke="#000" stroke-width="1"/>
  <circle cx="158" cy="96" r="8" fill="#241c1a" stroke="#000" stroke-width="1"/>
  <circle cx="90" cy="98" r="2.6" fill="#4a4a4a"/>
  <circle cx="158" cy="96" r="2.6" fill="#4a4a4a"/>
  <circle cx="222" cy="53" r="26" fill="url(#propBlur)"/>
  <ellipse cx="222" cy="53" rx="24" ry="4.5" fill="#e7ecef" opacity="0.75"/>
  <ellipse cx="222" cy="53" rx="4.5" ry="24" fill="#e7ecef" opacity="0.75"/>
  <ellipse cx="222" cy="53" rx="20" ry="3.5" fill="#dfe5e9" opacity="0.55" transform="rotate(45 222 53)"/>
  <ellipse cx="222" cy="53" rx="20" ry="3.5" fill="#dfe5e9" opacity="0.55" transform="rotate(-45 222 53)"/>
  <circle cx="222" cy="53" r="8" fill="url(#hubGrad)" stroke="#3a4046" stroke-width="1"/>
</svg>`);

export function createStars() {
  const stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.4 + 0.3,
      twinkle: Math.random() * Math.PI * 2,
    });
  }
  return stars;
}

function drawBackdrop(ctx, W, H, now, stars, crashed, motionX = 0, motionY = 0) {
  const bg = ctx.createRadialGradient(
    W * 0.55 + motionX * 0.5,
    H * 0.55 + motionY * 0.5,
    0,
    W * 0.55 + motionX * 0.5,
    H * 0.55 + motionY * 0.5,
    Math.max(W, H) * 0.75
  );
  if (crashed) {
    bg.addColorStop(0, "#241224");
    bg.addColorStop(1, "#0a0710");
  } else {
    bg.addColorStop(0, "#1a1030");
    bg.addColorStop(1, "#07050f");
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // faint rays fanning up from the bottom-left, same origin the curve uses
  ctx.save();
  ctx.translate(0, H);
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const angle = -Math.PI / 2 + (i - 7) * 0.11;
    ctx.lineTo(Math.cos(angle) * H * 1.6, Math.sin(angle) * H * 1.6);
    ctx.stroke();
  }
  ctx.restore();

  // twinkling stars
  ctx.save();
  ctx.translate(motionX * 0.3, motionY * 0.3);
  stars.forEach((s) => {
    const twinkle = 0.5 + 0.5 * Math.sin(now / 500 + s.twinkle);
    ctx.globalAlpha = 0.3 + twinkle * 0.5;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  ctx.globalAlpha = 1;
}

// Maps the real {t (seconds), multiplier} history onto the canvas,
// auto-rescaling both axes so the curve always fits — this is what
// makes it a true live plot instead of a fixed decorative shape.
function toScreenPoints(history, W, H) {
  const padL = 0;
  const padB = 0;
  const padT = 12;
  const padR = 12;
  const plotW = W - padL - padR;
  const plotH = H - padB - padT;

  const normalizedHistory = history.length === 0 || history[0].t !== 0 || history[0].multiplier !== 1
    ? [{ t: 0, multiplier: 1 }, ...history]
    : history;

  const last = normalizedHistory[normalizedHistory.length - 1];
  const maxT = Math.max(last.t, 4);
  const maxM = Math.max(
    normalizedHistory.reduce((max, p) => Math.max(max, p.multiplier - 1), 0),
    0.6
  );

  const xScale = plotW / maxT;
  const yScale = plotH / maxM;

  return normalizedHistory.map((p) => ({
    x: padL + p.t * xScale,
    y: H - padB - (p.multiplier - 1) * yScale,
  }));
}

/**
 * Draws one frame. Call this every requestAnimationFrame tick.
 *
 * @param ctx        canvas 2D context
 * @param W, H       canvas.width / canvas.height (already resized)
 * @param phase      "waiting" | "flying" | "crashed"
 * @param flightStartTime   Date.now()-based timestamp the round started flying (from useGameSocket)
 * @param finalCrashMultiplier  the settled crash multiplier once phase === "crashed", used to freeze the curve
 * @param now        performance.now() (used only for star twinkle / exhaust flicker)
 * @param stars      stable array from createStars(), kept in a ref
 */
export function renderFlightFrame(ctx, W, H, { phase, flightStartTime, finalCrashMultiplier, now, stars }) {
  const crashed = phase === "crashed";

  ctx.clearRect(0, 0, W, H);
  if (phase === "waiting" || !flightStartTime) {
    drawBackdrop(ctx, W, H, now, stars, crashed);
    return;
  }

  // While flying, use real elapsed wall-clock time so the curve is buttery
  // smooth every frame regardless of tick cadence. Once crashed, freeze it
  // at the exact elapsed time the settled crash multiplier corresponds to,
  // instead of continuing to grow or snapping to a stale point.
  const elapsedMs = crashed && finalCrashMultiplier
    ? elapsedMsForMultiplier(finalCrashMultiplier)
    : Date.now() - flightStartTime;

  const history = buildAnalyticHistory(elapsedMs);
  const screenPts = toScreenPoints(history, W, H);
  if (screenPts.length < 2) return;

  const motionX = screenPts[screenPts.length - 1].x - screenPts[0].x;
  const motionY = screenPts[screenPts.length - 1].y - screenPts[0].y;
  drawBackdrop(ctx, W, H, now, stars, crashed, motionX, motionY);

  // ---- filled area under the curve ----
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(screenPts[0].x, screenPts[0].y);

  drawSmoothPath(ctx, screenPts, CURVE_TENSION);

  ctx.lineTo(screenPts.at(-1).x, H);
  ctx.lineTo(0, H);
  ctx.closePath();

  const fillGrad = ctx.createLinearGradient(0, 30, 0, H - 8);
  if (crashed) {
    fillGrad.addColorStop(0, "rgba(120,120,130,0.35)");
    fillGrad.addColorStop(1, "rgba(120,120,130,0.03)");
  } else {
    fillGrad.addColorStop(0, "rgba(255,60,60,0.45)");
    fillGrad.addColorStop(1, "rgba(255,60,60,0.02)");
  }
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // ---- stroked, smoothed curve line ----
  ctx.beginPath();
  drawSmoothPath(ctx, screenPts, CURVE_TENSION);
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.imageSmoothingEnabled = true;
  ctx.strokeStyle = crashed ? "#8a8a94" : "#ff3b3b";
  ctx.shadowColor = crashed ? "transparent" : "#ff3b3b";
  ctx.shadowBlur = crashed ? 0 : 6;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ---- plane marker, riding the tip and rotated to the curve's real slope ----
  if (!crashed) {
    const tip = screenPts[screenPts.length - 1];
    const prev = screenPts[Math.max(0, screenPts.length - 8)];
    const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
    const planeWidth = 44;
    const planeHeight = 22;

    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(angle);

    if (planeImage.complete && planeImage.naturalWidth > 0 && planeImage.naturalHeight > 0) {
      ctx.drawImage(
        planeImage,
        -planeWidth / 2,
        -planeHeight / 2,
        planeWidth,
        planeHeight
      );
    } else {
      ctx.fillStyle = "#ff3b3b";
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}