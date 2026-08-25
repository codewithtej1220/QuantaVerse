/**
 * Small geometry helpers shared by the hand-rolled SVG charts.
 *
 * The radar chart is drawn by hand rather than pulled from a charting library:
 * the axes are quantum topics, the ghost polygon behind the learner's shape is
 * the cohort median, and both need to be styled with the site's own tokens.
 */

/** Points for a closed polygon on `count` evenly spaced axes, 12 o'clock first. */
export function radarPoints(values: number[], radius: number, cx = 0, cy = 0): string {
  const count = values.length;
  return values
    .map((value, i) => {
      const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
      const r = (Math.max(0, Math.min(100, value)) / 100) * radius;
      return `${(cx + Math.cos(angle) * r).toFixed(2)},${(cy + Math.sin(angle) * r).toFixed(2)}`;
    })
    .join(" ");
}

/** Cartesian position of axis `i` of `count`, at `radius`. */
export function axisPoint(i: number, count: number, radius: number, cx = 0, cy = 0) {
  const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}
