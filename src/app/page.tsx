"use client";
import React, { useRef, useEffect, useState } from "react";

const TWO_PI = Math.PI * 2;
const GAP_ANGLE = (36 * Math.PI) / 180; // 36° gap
const CAP_LEN = 5; // length of the radial cap line
const HALF_CAP = CAP_LEN / 2;
const COLLISION_PAD = 2; // extra pad for early collision
const POST_COLLISION_OFFSET = 0.5; // nudge after collision

const MIN_WALLS = 1;
const MAX_WALLS = 20;
const MAX_CANVAS_SIZE = 600; // maximum canvas size on desktop

// ------------------------------
// Helper: Convert hex to RGBA
// ------------------------------
function hexToRGBA(hex: string, alpha: number | string): string {
  let c = hex.replace("#", "");
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ------------------------------
// Types & Interfaces
// ------------------------------
interface CircleWall {
  id: number;
  radius: number;
  rotation: number;
  rotationSpeed: number;
  color?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
}

// ------------------------------
// Ball Class and Helpers
// ------------------------------
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
    this.vy += gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  reflect(nx: number, ny: number) {
    const dot = this.vx * nx + this.vy * ny;
    this.vx = this.vx - 2 * dot * nx;
    this.vy = this.vy - 2 * dot * ny;
    // Nudge to prevent sticking.
    this.x += nx * POST_COLLISION_OFFSET;
    this.y += ny * POST_COLLISION_OFFSET;
  }

  draw(ctx: CanvasRenderingContext2D, color: string = "#ffa500") {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, TWO_PI);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

// ------------------------------
// Wall Generation & Helpers
// ------------------------------
function generateCircleWalls(
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

function generateAlternateWalls(
  count: number,
  largestRadius: number,
  smallestRadius: number,
  color1?: string,
  color2?: string
): CircleWall[] {
  if (count <= 0) return [];
  if (count === 1)
    return [
      { id: 0, radius: largestRadius, rotation: 0, rotationSpeed: 0.01, color: color1 || "white" },
    ];
  const walls: CircleWall[] = [];
  const step = (largestRadius - smallestRadius) / (count - 1);
  const speed = 0.01; // constant speed
  for (let i = 0; i < count; i++) {
    const r = smallestRadius + step * i;
    const rotationSpeed = i % 2 === 0 ? speed : -speed;
    const color = i % 2 === 0 ? (color1 || "white") : (color2 || "red");
    walls.push({ id: i, radius: r, rotation: 0, rotationSpeed, color });
  }
  return walls;
}

function normalizeAngle(angle: number): number {
  return (angle % TWO_PI + TWO_PI) % TWO_PI;
}

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

// ------------------------------
// Collision Detection Functions
// ------------------------------
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

// ------------------------------
// Particle Functions (Shatter & Fireworks)
// ------------------------------
function createShatterParticles(
  wall: CircleWall,
  cx: number,
  cy: number,
  count: number = 20
): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * TWO_PI;
    const x = cx + wall.radius * Math.cos(angle);
    const y = cy + wall.radius * Math.sin(angle);
    const speed = Math.random() * 50 + 50;
    const vx = Math.cos(angle) * speed + (Math.random() - 0.5) * 50;
    const vy = Math.sin(angle) * speed + (Math.random() - 0.5) * 50;
    const radius = Math.random() * 2 + 1;
    const maxLife = Math.random() * 0.5 + 0.5;
    particles.push({
      x,
      y,
      vx,
      vy,
      radius,
      life: maxLife,
      maxLife,
      color: wall.color || "white",
    });
  }
  return particles;
}

function createFireworkParticles(cx: number, cy: number, count: number = 100): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * TWO_PI;
    const speed = Math.random() * 150 + 50;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const radius = Math.random() * 2 + 1;
    const maxLife = Math.random() * 0.5 + 0.5;
    const hue = Math.floor(Math.random() * 360);
    const color = `hsl(${hue}, 100%, 50%)`;
    particles.push({ x: cx, y: cy, vx, vy, radius, life: maxLife, maxLife, color });
  }
  return particles;
}

// ------------------------------
// Drawing Helpers
// ------------------------------
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

function drawWalls(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  walls: CircleWall[],
  mode?: "normal" | "alternate" | "growth"
) {
  ctx.save();
  walls.forEach((wall) => {
    ctx.strokeStyle = wall.color || "white";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    if (mode === "growth") {
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

// ------------------------------
// Main Component: Canvas & Animation
// ------------------------------
export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Responsive canvas.
  const [canvasSize, setCanvasSize] = useState(600);
  useEffect(() => {
    const updateSize = () => {
      const size = Math.min(window.innerWidth, window.innerHeight, MAX_CANVAS_SIZE);
      setCanvasSize(size);
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // User controls.
  const [gravity, setGravity] = useState(400);
  const [ballRadius, setBallRadius] = useState(10);
  const [numWalls, setNumWalls] = useState(10);
  const [removeWallOnPass, setRemoveWallOnPass] = useState(true);
  const [fadeStrength, setFadeStrength] = useState(0.75);
  const [mode, setMode] = useState<"normal" | "alternate" | "growth">("alternate");

  // Theme state.
  const [ballColor, setBallColor] = useState("#ffa500"); // default orange
  const [circleColor, setCircleColor] = useState("white");
  const [alternateCircleColor, setAlternateCircleColor] = useState("red");

  // Walls state.
  const [walls, setWalls] = useState<CircleWall[]>([]);

  // Regenerate walls when settings change.
  useEffect(() => {
    // We'll leave room at the top for the counter.
    const margin = 40;
    const largestRadius = (canvasSize - margin) / 2;
    if (mode === "normal") {
      setWalls(generateCircleWalls(numWalls, largestRadius, largestRadius * 0.23, circleColor));
    } else if (mode === "alternate") {
      setWalls(generateAlternateWalls(numWalls, largestRadius, largestRadius * 0.23, circleColor, alternateCircleColor));
    } else if (mode === "growth") {
      setWalls([{ id: 0, radius: largestRadius, rotation: 0, rotationSpeed: 0, color: circleColor }]);
    }
  }, [numWalls, canvasSize, mode, circleColor, alternateCircleColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const margin = 40;
    // Adjust the largest radius and center so there is room for the counter.
    const largestRadius = (canvasSize - margin) / 2;
    const cx = canvas.width / 2;
    const cy = largestRadius + margin; // push center down by margin
    
    // Create the ball at the center.
    const ball = new Ball(cx, cy, ballRadius, 100, -50);
    const particles: Particle[] = [];

    let localWalls = walls.map((w) => ({ ...w }));
    let lastTime = performance.now();
    let animationFrameId: number;
    let fireworks: Particle[] = [];
    const maxTrailLength = 30;
    const ballTrail: { x: number; y: number }[] = [];
    let celebrating = false;
    let celebrationStartTime = 0;

    function animate(time: number) {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      if(!ctx) return;
      if(!canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw walls.
      drawWalls(ctx, cx, cy, localWalls, mode);
      
      // Update wall rotations (if applicable).
      if (mode !== "growth") {
        localWalls.forEach((wall) => {
          wall.rotation = normalizeAngle(wall.rotation + wall.rotationSpeed * dt * 60);
        });
      }
      
      const prevX = ball.x;
      const prevY = ball.y;
      ball.update(dt, gravity);
      
      ballTrail.push({ x: ball.x, y: ball.y });
      if (ballTrail.length > maxTrailLength) {
        ballTrail.shift();
      }
      
      // --- Collision Handling ---
      if (mode === "growth") {
        const wall = localWalls[0];
        const currDist = Math.hypot(ball.x - cx, ball.y - cy);
        // If the ball's outer edge goes past the wall...
        if (currDist + ball.radius > wall.radius) {
          // Compute the normalized vector from the circle center to the ball.
          const normalX = (ball.x - cx) / currDist;
          const normalY = (ball.y - cy) / currDist;
          // Clamp the ball so it touches the wall exactly.
          ball.x = cx + (wall.radius - ball.radius) * normalX;
          ball.y = cy + (wall.radius - ball.radius) * normalY;
          // Reflect the ball's velocity along that normal.
          ball.reflect(normalX, normalY);
          // Increase size and speed.
          ball.radius += 2;
          ball.vx *= 1.05;
          ball.vy *= 1.05;
          // Reset the game if the ball is almost as big as the circle.
          if (ball.radius >= wall.radius - 1) {
            ball.x = cx;
            ball.y = cy;
            ball.vx = 100;
            ball.vy = -50;
            ball.radius = ballRadius;
          }
        }      
      } else {
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
          const capCollision2 = checkRadialCap(
            ball,
            cx,
            cy,
            wall,
            wall.rotation + GAP_ANGLE
          );
          if (capCollision2 && capCollision2.collision) {
            ball.x = prevX;
            ball.y = prevY;
            ball.reflect(capCollision2.normalX, capCollision2.normalY);
            break;
          }
          if (
            removeWallOnPass &&
            Math.abs(Math.hypot(ball.x - cx, ball.y - cy) - wall.radius) < ball.radius &&
            isAngleInGap(Math.atan2(ball.y - cy, ball.x - cx), wall.rotation)
          ) {
            const shatter = createShatterParticles(wall, cx, cy, 20);
            particles.push(...shatter);
            localWalls.splice(i, 1);
            i--;
          }
        }
      }
      
      if (mode !== "growth") {
        const ballDist = Math.hypot(ball.x - cx, ball.y - cy);
        if (!celebrating && ballDist > largestRadius + ball.radius) {
          celebrating = true;
          celebrationStartTime = time;
          const explosionPoints = [
            { x: ball.x, y: ball.y },
            { x: Math.random() * canvas.width, y: Math.random() * canvas.height },
            { x: Math.random() * canvas.width, y: Math.random() * canvas.height },
          ];
          fireworks = [];
          explosionPoints.forEach((point) => {
            fireworks.push(...createFireworkParticles(point.x, point.y, 50));
          });
        }
      }
      
      if (celebrating) {
        for (let i = fireworks.length - 1; i >= 0; i--) {
          const fp = fireworks[i];
          fp.x += fp.vx * dt;
          fp.y += fp.vy * dt;
          fp.life -= dt;
          if (fp.life <= 0) {
            fireworks.splice(i, 1);
          } else {
            const alpha = fp.life / fp.maxLife;
            let colorStr = fp.color;
            if (colorStr.startsWith("hsl(")) {
              colorStr = colorStr.replace("hsl(", "hsla(").replace(")", `,${alpha.toFixed(2)})`);
            }
            ctx.beginPath();
            ctx.arc(fp.x, fp.y, fp.radius, 0, TWO_PI);
            ctx.fillStyle = colorStr;
            ctx.fill();
          }
        }
        if (time - celebrationStartTime > 3000) {
          celebrating = false;
          ball.x = cx;
          ball.y = cy;
          ball.vx = 100;
          ball.vy = -50;
          ballTrail.length = 0;
          const newLargestRadius = (canvasSize - margin) / 2;
          const smallestRadius = newLargestRadius * 0.23;
          if (mode === "normal") {
            localWalls = generateCircleWalls(numWalls, newLargestRadius, smallestRadius, circleColor);
          } else if (mode === "alternate") {
            localWalls = generateAlternateWalls(numWalls, newLargestRadius, smallestRadius, circleColor, alternateCircleColor);
          }
          fireworks = [];
        }
      }
      
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
        } else {
          const alpha = p.life / p.maxLife;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, TWO_PI);
          ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
          ctx.fill();
        }
      }
      
      if (!celebrating) {
        const baseAlpha = 0.5;
        for (let i = 0; i < ballTrail.length; i++) {
          const pos = ballTrail[i];
          const relativeAge = (i + 1) / ballTrail.length;
          const alpha = baseAlpha * (1 - fadeStrength) * relativeAge;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, ball.radius, 0, TWO_PI);
          ctx.fillStyle = hexToRGBA(ballColor, alpha);
          ctx.fill();
        }
        ball.draw(ctx, ballColor);
      }
      
      // Draw counter above the outer circle.
      ctx.fillStyle = "white";
      ctx.font = "20px sans-serif";
      const counterText =
        mode === "growth" ? `Ball Size: ${Math.round(ball.radius)}` : `Circles Left: ${localWalls.length}`;
      const textMetrics = ctx.measureText(counterText);
      // The counter is drawn just above the outer circle.
      ctx.fillText(counterText, cx - textMetrics.width / 2, cy - largestRadius - 10);
      
      animationFrameId = requestAnimationFrame(animate);
    }
    
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gravity, ballRadius, walls, removeWallOnPass, canvasSize, fadeStrength, mode, ballColor]);
  
  return (
    <main className="min-h-screen bg-black flex flex-col md:flex-row p-4 pt-20 overflow-x-hidden">
      <div className="flex-1 flex items-center justify-center mb-4 md:mb-0">
        <canvas ref={canvasRef} className="bg-black" />
      </div>
      <div className="w-full md:w-72 md:ml-4 text-white flex flex-col gap-4">
        {/* Mode Selector */}
        <div>
          <label className="block mb-1 text-sm">Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "normal" | "alternate" | "growth")}
            className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded w-full"
          >
            <option value="normal">Normal</option>
            <option value="alternate">Alternate</option>
            <option value="growth">Growth</option>
          </select>
        </div>
        {/* Gravity Slider */}
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
        {/* Ball Radius Slider */}
        <div>
          <label className="block mb-1 text-sm">Initial Ball Radius: {ballRadius}</label>
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
        {/* Number of Walls Slider (not used in Growth mode) */}
        {mode !== "growth" && (
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
        )}
        {/* Remove Wall on Pass Checkbox (not used in Growth mode) */}
        {mode !== "growth" && (
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
        )}
        {/* Trail Fade Slider (not used in Growth mode) */}
        {mode !== "growth" && (
          <div>
            <label className="block mb-1 text-sm">
              Trail Fade: {fadeStrength.toFixed(2)} (0 = full trail, 1 = no trail)
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={fadeStrength}
              onChange={(e) => setFadeStrength(Number(e.target.value))}
              className="w-full"
            />
          </div>
        )}
        {/* Theme Settings */}
        <div>
          <label className="block mb-1 text-sm">Ball Color</label>
          <input
            type="color"
            value={ballColor}
            onChange={(e) => setBallColor(e.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm">Circle Color</label>
          <input
            type="color"
            value={circleColor}
            onChange={(e) => setCircleColor(e.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm">Alternate Circle Color</label>
          <input
            type="color"
            value={alternateCircleColor}
            onChange={(e) => setAlternateCircleColor(e.target.value)}
            className="w-full"
          />
        </div>
      </div>
    </main>
  );
}
