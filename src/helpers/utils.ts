// src/helpers/utils.ts
export const TWO_PI = Math.PI * 2;
export const GAP_ANGLE = (36 * Math.PI) / 180; // 36° gap
export const CAP_LEN = 5; // length of the radial cap line
export const HALF_CAP = CAP_LEN / 2;
export const COLLISION_PAD = 2; // extra pad for early collision
export const POST_COLLISION_OFFSET = 0.5; // nudge after collision

export function hexToRGBA(hex: string, alpha: number | string): string {
  let c = hex.replace("#", "");
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function randomVelocity(speed = 150) {
  const angle = Math.random() * TWO_PI;
  return {
    vx: speed * Math.cos(angle),
    vy: speed * Math.sin(angle),
  };
}

export function randomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 100%, 50%)`;
}

export function normalizeAngle(angle: number): number {
  return (angle % TWO_PI + TWO_PI) % TWO_PI;
}

export function isAngleInGap(angle: number, gapStart: number): boolean {
  const normAngle = normalizeAngle(angle);
  const normGapStart = normalizeAngle(gapStart);
  const normGapEnd = normalizeAngle(gapStart + GAP_ANGLE);
  if (normGapStart < normGapEnd) {
    return normAngle >= normGapStart && normAngle < normGapEnd;
  } else {
    return normAngle >= normGapStart || normAngle < normGapEnd;
  }
}

export function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}
