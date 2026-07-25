// ============================================================================
// flightCanvas.js - Fully Operational Analytical Curve Canvas Implementation
// - Starts smoothly at the baseline without bowing/dipping below the bottom border
// - Matches the exact aesthetic layout of the reference Aviator screenshot
// - Perfect smooth scaling curve tracking up to infinite crash limits
// ============================================================================

const STAR_COUNT = 90;
const GROWTH = 0.00012;
const CURVE_SAMPLES = 200;

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

export function drawFlightFrame(canvas, ctx, elapsedMs, currentMultiplier, stars, isCrashed) {
  if (!canvas || !ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const now = Date.now();

  // 1. Draw Backdrop Layout (Sunburst Rays and Starfield Matrix)
  ctx.save();
  const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
  bg.addColorStop(0, isCrashed ? "#220b1e" : "#240a2b");
  bg.addColorStop(1, "#07040d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Background Sunburst Rays emanating precisely from the bottom-left origin
  ctx.save();
  ctx.translate(0, H);
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = "#ffffff";
  const numRays = 18;
  for (let i = 0; i < numRays; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const angle1 = -(Math.PI / 2) * (i / numRays);
    const angle2 = -(Math.PI / 2) * ((i + 0.5) / numRays);
    ctx.lineTo(Math.cos(angle1) * W * 2, Math.sin(angle1) * H * 2);
    ctx.lineTo(Math.cos(angle2) * W * 2, Math.sin(angle2) * H * 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Twinkling background star cluster elements
  stars.forEach((s) => {
    const twinkle = 0.3 + 0.7 * Math.sin(now / 400 + s.twinkle);
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  // 2. Generate and Plot Points Analytically (Strict Monotonic Growth)
  const pts = [];
  const activeTimeMs = Math.max(0, elapsedMs);

  // Dynamic Scale bounds to ensure look remains identical as multiplier stretches outwards
  const maxMultiplierDisplay = Math.max(currentMultiplier, 2.0);

  for (let i = 0; i <= CURVE_SAMPLES; i++) {
    const ratio = i / CURVE_SAMPLES;
    const sampleTimeMs = activeTimeMs * ratio;
    const sampleMultiplier = Math.exp(GROWTH * sampleTimeMs);

    // X-Axis scales uniformly with elapsed time
    const screenX = ratio * (W * 0.73); 

    // Y-Axis uses a quadratic layout factor combined with the multiplier profile to stay curved
    const normalizedY = (sampleMultiplier - 1) / (maxMultiplierDisplay - 1 || 1);
    const curveFactor = Math.pow(ratio, 1.8) * 0.4 + normalizedY * 0.6;
    const screenY = H - curveFactor * (H * 0.78);

    pts.push({ x: screenX, y: screenY });
  }

  // 3. Draw Red Under-Curve Area Fill & Glowing Curve Line Path
  if (pts.length > 1) {
    // Under-Curve Red Backdrop Area Fill Vector
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, H);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, H);
    ctx.closePath();
    
    const fillGlow = ctx.createLinearGradient(0, H, 0, H * 0.3);
    fillGlow.addColorStop(0, "rgba(163, 11, 31, 0.0)");
    fillGlow.addColorStop(1, isCrashed ? "rgba(100, 10, 20, 0.45)" : "rgba(179, 14, 38, 0.55)");
    ctx.fillStyle = fillGlow;
    ctx.fill();
    ctx.restore();

    // Red Stroke Vector Line Path
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = isCrashed ? "#630b15" : "#e81a36";
    ctx.lineWidth = 3.5;
    ctx.shadowBlur = isCrashed ? 0 : 10;
    ctx.shadowColor = "#ff2442";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
  }

  // 4. Render Flying Jet Asset Object & Rotational Trajectory Alignment
  const targetPt = pts[pts.length - 1];
  if (targetPt && !isCrashed) {
    ctx.save();
    ctx.translate(targetPt.x, targetPt.y);

    // Calculate rotational angle targeting using vector differentials of previous samples
    const prevPt = pts[pts.length - 5] || pts[0];
    const angle = Math.atan2(targetPt.y - prevPt.y, targetPt.x - prevPt.x);
    ctx.rotate(angle);

    // Center and scale structural dimensions of the plane SVG container asset 
    const planeW = 65;
    const planeH = 30;
    ctx.drawImage(planeImage, -planeW * 0.85, -planeH * 0.5, planeW, planeH);
    ctx.restore();
  }
}

// Inline Vector Plane SVG asset matching standard high-contrast red racing layout
const planeImage = new Image();
planeImage.src =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://w3.org" width="250" height="110" viewBox="0 0 250 110">
  <path d="M18 55 L4 30 L14 30 L28 52 Z" fill="#ff4d4d" />
  <path d="M18 58 L2 74 L10 76 L24 60 Z" fill="#b30000" />
  <path d="M60 78 L172 66 L182 74 L64 90 Z" fill="#ff1a1a" />
  <path d="M22 52 C 22 40, 40 32, 70 31 L 180 40 C 205 42, 214 48, 222 53 C 214 58, 205 63, 180 65 L 70 70 C 40 69, 22 62, 22 52 Z" fill="#ff1a1a" stroke="#ffffff" stroke-width="2"/>
  <ellipse cx="118" cy="45" rx="12" ry="8" fill="#bfe8ff"/>
  <path d="M56 28 L170 18 L180 26 L60 38 Z" fill="#ff3333" />
  <circle cx="222" cy="53" r="8" fill="#ffffff"/>
</svg>`);
