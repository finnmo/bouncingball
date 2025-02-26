"use client";
import React, { useRef, useEffect, useState } from "react";

const TWO_PI = Math.PI * 2;
const GAP_ANGLE = (36 * Math.PI) / 180; // 36° gap
const CAP_LEN = 5; // length of the radial cap line
const HALF_CAP = CAP_LEN / 2;
const COLLISION_PAD = 2; // extra pad to trigger collision slightly early
const POST_COLLISION_OFFSET = 0.5; // nudge after collision

const LARGEST_RADIUS = 260;
const SMALLEST_RADIUS = 60;
const MIN_WALLS = 1;
const MAX_WALLS = 20;

interface CircleWall {
  id: number;
  radius: number;
  rotation: number;
  rotationSpeed: number;
}

// -------------------------------------
// Ball Class and Helper Functions
// -------------------------------------
class Ball {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;

  constructor(x: number, y: number, radius: number, vx: number, vy: number) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.vx = vx;
    this.vy = vy;
  }

  update(dt: number, gravity: number) {
    // Apply gravity (in pixels/s², scaled by delta time)
    this.vy += gravity * dt;
    // Update position using velocity (pixels per second)
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  reflect(nx: number, ny: number) {
    const dot = this.vx * nx + this.vy * ny;
    this.vx = this.vx - 2 * dot * nx;
    this.vy = this.vy - 2 * dot * ny;
    // Nudge to prevent sticking to surfaces
    this.x += nx * POST_COLLISION_OFFSET;
    this.y += ny * POST_COLLISION_OFFSET;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, TWO_PI);
    ctx.fillStyle = "orange";
    ctx.fill();
  }
}

// Generate walls evenly spaced between SMALLEST_RADIUS and LARGEST_RADIUS
function generateCircleWalls(count: number): CircleWall[] {
  if (count <= 0) return [];
  if (count === 1) {
    return [{ id: 0, radius: LARGEST_RADIUS, rotation: 0, rotationSpeed: 0.005 }];
  }
  const walls: CircleWall[] = [];
  const step = (LARGEST_RADIUS - SMALLEST_RADIUS) / (count - 1);
  for (let i = 0; i < count; i++) {
    const r = SMALLEST_RADIUS + step * i;
    const speed = 0.003 + 0.002 * (i % 2 === 0 ? 1 : -1);
    walls.push({ id: i, radius: r, rotation: 0, rotationSpeed: speed });
  }
  return walls;
}

// Normalize an angle to [0, TWO_PI)
function normalizeAngle(angle: number): number {
  return (angle % TWO_PI + TWO_PI) % TWO_PI;
}

// Check if an angle lies within the wall’s gap region.
function isAngleInGap(angle: number, gapStart: number): boolean {
  const normAngle = normalizeAngle(angle);
  const normGapStart = normalizeAngle(gapStart);
  const normGapEnd = normalizeAngle(gapStart + GAP_ANGLE);
  if (normGapStart < normGapEnd) {
    return normAngle >= normGapStart && normAngle < normGapEnd;
  } else {
    return normAngle >= normGapStart || normAngle < normGapEnd;
  }
}

// Compute the shortest distance from a point to a line segment.
function pointToSegmentDistance(
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

// -------------------------------------
// Collision Detection Functions
// -------------------------------------

function checkArcCollision(
  ball: Ball,
  prevX: number,
  prevY: number,
  cx: number,
  cy: number,
  wall: CircleWall
): { collision: boolean; normalX: number; normalY: number } | null {
  const currDist = Math.hypot(ball.x - cx, ball.y - cy);
  const prevDist = Math.hypot(prevX - cx, prevY - cy);
  if (
    Math.abs(currDist - wall.radius) <= ball.radius + COLLISION_PAD &&
    Math.abs(prevDist - wall.radius) > ball.radius + COLLISION_PAD
  ) {
    const collisionAngle = Math.atan2(ball.y - cy, ball.x - cx);
    if (!isAngleInGap(collisionAngle, wall.rotation)) {
      const nx = (ball.x - cx) / currDist;
      const ny = (ball.y - cy) / currDist;
      return { collision: true, normalX: nx, normalY: ny };
    }
  }
  return null;
}

function checkRadialCap(
  ball: Ball,
  cx: number,
  cy: number,
  wall: CircleWall,
  capAngle: number
): { collision: boolean; normalX: number; normalY: number } | null {
  const startX = cx + (wall.radius - HALF_CAP) * Math.cos(capAngle);
  const startY = cy + (wall.radius - HALF_CAP) * Math.sin(capAngle);
  const endX = cx + (wall.radius + HALF_CAP) * Math.cos(capAngle);
  const endY = cy + (wall.radius + HALF_CAP) * Math.sin(capAngle);
  const d = pointToSegmentDistance(ball.x, ball.y, startX, startY, endX, endY);
  if (d <= ball.radius + COLLISION_PAD) {
    const dx = endX - startX;
    const dy = endY - startY;
    const lenSq = dx * dx + dy * dy;
    let t = ((ball.x - startX) * dx + (ball.y - startY) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = startX + t * dx;
    const projY = startY + t * dy;
    let nx = ball.x - projX;
    let ny = ball.y - projY;
    const mag = Math.hypot(nx, ny);
    if (mag > 0) {
      nx /= mag;
      ny /= mag;
    } else {
      const dist = Math.hypot(ball.x - cx, ball.y - cy);
      nx = (ball.x - cx) / dist;
      ny = (ball.y - cy) / dist;
    }
    return { collision: true, normalX: nx, normalY: ny };
  }
  return null;
}

// -------------------------------------
// Main Component with Animation Loop
// -------------------------------------
export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Updated gravity slider range for a visible effect.
  const [gravity, setGravity] = useState(500); // in pixels/s²
  const [ballRadius, setBallRadius] = useState(10);
  const [numWalls, setNumWalls] = useState(10);
  const [removeWallOnPass, setRemoveWallOnPass] = useState(false);
  const [fadeStrength, setFadeStrength] = useState(0.2);
  const [walls, setWalls] = useState<CircleWall[]>([]);

  useEffect(() => {
    setWalls(generateCircleWalls(numWalls));
  }, [numWalls]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cw = canvas.width;
    const ch = canvas.height;
    const cx = cw / 2;
    const cy = ch / 2;

    // Create a ball at the center with an initial velocity.
    const ball = new Ball(cx, cy, ballRadius, 100, -50);
    let lastTime = performance.now();
    let animationFrameId: number;
    let localWalls = walls.map((w) => ({ ...w }));

    function animate(time: number) {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      // Create a trailing effect.
      if(!ctx) return;
      ctx.fillStyle = `rgba(0,0,0,${fadeStrength})`;
      ctx.fillRect(0, 0, cw, ch);

      // Update wall rotations.
      localWalls.forEach((wall) => {
        wall.rotation = normalizeAngle(wall.rotation + wall.rotationSpeed * dt * 60);
      });

      // Save previous ball position.
      const prevX = ball.x;
      const prevY = ball.y;
      ball.update(dt, gravity);

      // Collision detection for each wall.
      for (let i = 0; i < localWalls.length; i++) {
        const wall = localWalls[i];
        const arcCollision = checkArcCollision(ball, prevX, prevY, cx, cy, wall);
        if (arcCollision && arcCollision.collision) {
          ball.x = prevX;
          ball.y = prevY;
          ball.reflect(arcCollision.normalX, arcCollision.normalY);
          break;
        }
        const capCollision1 = checkRadialCap(ball, cx, cy, wall, wall.rotation);
        if (capCollision1 && capCollision1.collision) {
          ball.x = prevX;
          ball.y = prevY;
          ball.reflect(capCollision1.normalX, capCollision1.normalY);
          break;
        }
        const capCollision2 = checkRadialCap(ball, cx, cy, wall, wall.rotation + GAP_ANGLE);
        if (capCollision2 && capCollision2.collision) {
          ball.x = prevX;
          ball.y = prevY;
          ball.reflect(capCollision2.normalX, capCollision2.normalY);
          break;
        }
        // Optionally remove the wall if the ball passes through its gap.
        const ballDist = Math.hypot(ball.x - cx, ball.y - cy);
        if (
          Math.abs(ballDist - wall.radius) < ball.radius &&
          isAngleInGap(Math.atan2(ball.y - cy, ball.x - cx), wall.rotation)
        ) {
          if (removeWallOnPass) {
            localWalls.splice(i, 1);
            i--;
          }
        }
      }

      drawWalls(ctx, cx, cy, localWalls);
      ball.draw(ctx);
      animationFrameId = requestAnimationFrame(animate);
    }
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gravity, ballRadius, walls, removeWallOnPass, fadeStrength]);

  return (
    <main className="min-h-screen bg-black flex flex-col md:flex-row p-4">
      <div className="flex-1 flex items-center justify-center mb-4 md:mb-0">
        <canvas ref={canvasRef} width={600} height={600} className="bg-black" />
      </div>
      <div className="w-full md:w-72 md:ml-4 text-white flex flex-col gap-4">
        <div>
          <label className="block mb-1 text-sm">Gravity: {gravity.toFixed(0)}</label>
          <input
            type="range"
            min="0"
            max="1000"
            step="10"
            value={gravity}
            onChange={(e) => setGravity(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm">Ball Radius: {ballRadius}</label>
          <input
            type="range"
            min="5"
            max="40"
            step="1"
            value={ballRadius}
            onChange={(e) => setBallRadius(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm">Number of Walls: {numWalls}</label>
          <input
            type="range"
            min={MIN_WALLS}
            max={MAX_WALLS}
            step="1"
            value={numWalls}
            onChange={(e) => setNumWalls(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="removeWallOnPass"
            checked={removeWallOnPass}
            onChange={(e) => setRemoveWallOnPass(e.target.checked)}
          />
          <label htmlFor="removeWallOnPass" className="text-sm">
            Remove Wall When Ball Passes Gap
          </label>
        </div>
        <div>
          <label className="block mb-1 text-sm">Trail Fade: {fadeStrength.toFixed(2)}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={fadeStrength}
            onChange={(e) => setFadeStrength(Number(e.target.value))}
            className="w-full"
          />
          <p className="text-xs opacity-80">0 = permanent trail, 1 = no trail</p>
        </div>
      </div>
    </main>
  );
}

// -------------------------------------
// Drawing Helpers
// -------------------------------------
function drawWalls(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  walls: CircleWall[]
) {
  ctx.save();
  ctx.strokeStyle = "white";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  walls.forEach((wall) => {
    const startAngle = wall.rotation + GAP_ANGLE;
    const endAngle = wall.rotation + TWO_PI;
    ctx.beginPath();
    ctx.arc(cx, cy, wall.radius, startAngle, endAngle, false);
    ctx.stroke();
    drawRadialCap(ctx, cx, cy, wall.radius, wall.rotation);
    drawRadialCap(ctx, cx, cy, wall.radius, wall.rotation + GAP_ANGLE);
  });
  ctx.restore();
}

function drawRadialCap(
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
