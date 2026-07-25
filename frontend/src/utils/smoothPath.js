// Catmull-Rom to cubic Bezier conversion for smooth curves.
// Produces smooth, visually pleasing curves that closely follow the sampled points.
export function buildSmoothPath(points, tension = 1) {
  if (!Array.isArray(points) || points.length < 2) return "";

  const pts = points.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (pts.length < 2) return "";

  // If only two points, simple line
  if (pts.length === 2) {
    const a = pts[0];
    const b = pts[1];
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  }

  // Helper: get point with clamping at ends
  const get = (i) => {
    if (i < 0) return pts[0];
    if (i >= pts.length) return pts[pts.length - 1];
    return pts[i];
  };

  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;

  // Convert each segment between pts[i] -> pts[i+1] into a cubic bezier
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);

    // Catmull-Rom to Bezier control points
    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension;

    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return d;
}
