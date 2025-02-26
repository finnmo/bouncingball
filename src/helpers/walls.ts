// src/helpers/walls.ts
import { HALF_CAP, GAP_ANGLE, TWO_PI } from "./utils";

export interface CircleWall {
  id: number;
  radius: number;
  rotation: number;
  rotationSpeed: number;
  color?: string;
}

export function generateCircleWalls(
  count: number,
  largestRadius: number,
  smallestRadius: number,
  defaultColor?: string
): CircleWall[] {
  if (count <= 0) return [];
  if (count === 1)
    return [{ id: 0, radius: largestRadius, rotation: 0, rotationSpeed: 0.005, color: defaultColor || "white" }];
  const walls: CircleWall[] = [];
  const step = (largestRadius - smallestRadius) / (count - 1);
  for (let i = 0; i < count; i++) {
    const r = smallestRadius + step * i;
    const speed = 0.003 + 0.002 * (i % 2 === 0 ? 1 : -1);
    walls.push({ id: i, radius: r, rotation: 0, rotationSpeed: speed, color: defaultColor || "white" });
  }
  return walls;
}

export function generateAlternateWalls(
  count: number,
  largestRadius: number,
  smallestRadius: number,
  color1?: string,
  color2?: string
): CircleWall[] {
  if (count <= 0) return [];
  if (count === 1)
    return [{ id: 0, radius: largestRadius, rotation: 0, rotationSpeed: 0.01, color: color1 || "white" }];
  const walls: CircleWall[] = [];
  const step = (largestRadius - smallestRadius) / (count - 1);
  const speed = 0.01;
  for (let i = 0; i < count; i++) {
    const r = smallestRadius + step * i;
    const rotationSpeed = i % 2 === 0 ? speed : -speed;
    const color = i % 2 === 0 ? (color1 || "white") : (color2 || "red");
    walls.push({ id: i, radius: r, rotation: 0, rotationSpeed, color });
  }
  return walls;
}

export function drawRadialCap(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  angle: number
) {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const inner = radius - HALF_CAP;
  const outer = radius + HALF_CAP;
  const sx = cx + inner * cosA;
  const sy = cy + inner * sinA;
  const ex = cx + outer * cosA;
  const ey = cy + outer * sinA;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
}

export function drawWalls(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  walls: CircleWall[],
  mode?: "normal" | "alternate" | "growth" | "spawn"
) {
  ctx.save();
  walls.forEach((wall) => {
    ctx.strokeStyle = wall.color || "white";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    if (mode === "growth" || mode === "spawn") {
      ctx.beginPath();
      ctx.arc(cx, cy, wall.radius, 0, TWO_PI);
      ctx.stroke();
    } else {
      const startAngle = wall.rotation + GAP_ANGLE;
      const endAngle = wall.rotation + TWO_PI;
      ctx.beginPath();
      ctx.arc(cx, cy, wall.radius, startAngle, endAngle, false);
      ctx.stroke();
      drawRadialCap(ctx, cx, cy, wall.radius, wall.rotation);
      drawRadialCap(ctx, cx, cy, wall.radius, wall.rotation + GAP_ANGLE);
    }
  });
  ctx.restore();
}
