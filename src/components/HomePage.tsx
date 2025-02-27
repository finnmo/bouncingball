"use client";
import React, { useRef, useEffect, useState } from "react";
import { isAngleInGap, hexToRGBA, TWO_PI, randomVelocity, randomColor, GAP_ANGLE } from "../helpers/utils";
import { Ball } from "../helpers/ball";
import { generateCircleWalls, generateAlternateWalls, drawWalls, CircleWall } from "../helpers/walls";
import { checkArcCollision, checkRadialCap } from "../helpers/collision";
import { createShatterParticles, createFireworkParticles, Particle } from "../helpers/particles";

const MIN_WALLS = 1;
const MAX_WALLS = 20;
const MAX_CANVAS_SIZE = 600;

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  const [gravity, setGravity] = useState(400);
  const [ballRadius, setBallRadius] = useState(10);
  const [numWalls, setNumWalls] = useState(10);
  const [removeWallOnPass, setRemoveWallOnPass] = useState(true);
  const [fadeStrength, setFadeStrength] = useState(0.75);
  const [mode, setMode] = useState<"normal" | "alternate" | "growth" | "spawn">("alternate");
  const [ballColor, setBallColor] = useState("#ffa500");
  const [circleColor, setCircleColor] = useState("white");
  const [alternateCircleColor, setAlternateCircleColor] = useState("red");

  // Use the proper type here for walls instead of any[]
  const [walls, setWalls] = useState<CircleWall[]>([]);

  // Regenerate walls when settings change.
  useEffect(() => {
    const margin = 40; // leave room at the top for counter
    const largestRadius = (canvasSize - margin) / 2;
    if (mode === "normal") {
      setWalls(generateCircleWalls(numWalls, largestRadius, largestRadius * 0.23, circleColor));
    } else if (mode === "alternate") {
      setWalls(generateAlternateWalls(numWalls, largestRadius, largestRadius * 0.23, circleColor, alternateCircleColor));
    } else if (mode === "growth" || mode === "spawn") {
      setWalls([{ id: 0, radius: largestRadius, rotation: 0, rotationSpeed: 0, color: circleColor }]);
    }
  }, [numWalls, canvasSize, mode, circleColor, alternateCircleColor]); // added missing dependencies

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const margin = 40;
    const largestRadius = (canvasSize - margin) / 2;
    const cx = canvas.width / 2;
    const cy = largestRadius + margin; // push center down by margin

    let lastTime = performance.now();
    let animationFrameId: number;
    const particles: Particle[] = []; // typed properly
    let fireworks: Particle[] = []; // typed properly
    const maxTrailLength = 30;
    const ballTrail: { x: number; y: number }[] = [];
    let celebrating = false;
    let celebrationStartTime = 0;
    let localWalls = walls.map((w) => ({ ...w }));

    if (mode === "spawn") {
      const initialVel = randomVelocity(150);
      // Use const since spawnBalls is never reassigned.
      const spawnBalls: Ball[] = [
        new Ball(cx, cy, ballRadius, initialVel.vx, initialVel.vy, randomColor()),
      ];

      function animate(time: number) {
        const dt = (time - lastTime) / 1000;
        lastTime = time;
        if(!ctx) return;
        if(!canvas) return; 
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the wall (full circle).
        drawWalls(ctx, cx, cy, localWalls, "spawn");

        // Update each ball.
        for (let i = 0; i < spawnBalls.length; i++) {
          const ball = spawnBalls[i];
          const prevX = ball.x;
          const prevY = ball.y;
          ball.update(dt, gravity * 0.05);
          const currDist = Math.hypot(ball.x - cx, ball.y - cy);
          const prevDist = Math.hypot(prevX - cx, prevY - cy);
          if (
            prevDist + ball.radius < localWalls[0].radius &&
            currDist + ball.radius >= localWalls[0].radius
          ) {
            const normalX = (ball.x - cx) / currDist;
            const normalY = (ball.y - cy) / currDist;
            ball.x = cx + (localWalls[0].radius - ball.radius) * normalX;
            ball.y = cy + (localWalls[0].radius - ball.radius) * normalY;
            ball.reflect(normalX, normalY);
            if (spawnBalls.length < 2000) {
              const newVel = randomVelocity(150);
              spawnBalls.push(new Ball(cx, cy, ballRadius, newVel.vx, newVel.vy, randomColor()));
            }
          }
          ball.draw(ctx);
        }
        ctx.fillStyle = "white";
        ctx.font = "20px sans-serif";
        const counterText = `Balls: ${spawnBalls.length}`;
        const textMetrics = ctx.measureText(counterText);
        ctx.fillText(counterText, cx - textMetrics.width / 2, cy - localWalls[0].radius - 10);
        animationFrameId = requestAnimationFrame(animate);
      }
      animationFrameId = requestAnimationFrame(animate);
    } else {
      const ball = new Ball(cx, cy, ballRadius, 100, -50);
      function animate(time: number) {
        if(!ctx) return;
        if(!canvas) return; 
        const dt = (time - lastTime) / 1000;
        lastTime = time;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        drawWalls(ctx, cx, cy, localWalls, mode);
        
        if (mode !== "growth") {
          localWalls.forEach((wall) => {
            wall.rotation = (wall.rotation + wall.rotationSpeed * dt * 60) % TWO_PI;
          });
        }
        
        const prevX = ball.x;
        const prevY = ball.y;
        ball.update(dt, gravity);
        
        ballTrail.push({ x: ball.x, y: ball.y });
        if (ballTrail.length > maxTrailLength) {
          ballTrail.shift();
        }
        
        if (mode === "growth") {
          const wall = localWalls[0];
          const currDist = Math.hypot(ball.x - cx, ball.y - cy);
          if (currDist + ball.radius > wall.radius) {
            const normalX = (ball.x - cx) / currDist;
            const normalY = (ball.y - cy) / currDist;
            ball.x = cx + (wall.radius - ball.radius) * normalX;
            ball.y = cy + (wall.radius - ball.radius) * normalY;
            ball.reflect(normalX, normalY);
            ball.radius += 2;
            ball.vx *= 1.05;
            ball.vy *= 1.05;
            if (ball.radius >= wall.radius - 1) {
              ball.x = cx + 10;
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
            const capCollision2 = checkRadialCap(ball, cx, cy, wall, wall.rotation + GAP_ANGLE);
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
        
        ctx.fillStyle = "white";
        ctx.font = "20px sans-serif";
        const counterText =
          mode === "growth" ? `Ball Size: ${Math.round(ball.radius)}` : `Circles Left: ${localWalls.length}`;
        const textMetrics = ctx.measureText(counterText);
        ctx.fillText(counterText, cx - textMetrics.width / 2, cy - largestRadius - 10);
        
        animationFrameId = requestAnimationFrame(animate);
      }
      animationFrameId = requestAnimationFrame(animate);
    }
    
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
            onChange={(e) =>
              setMode(e.target.value as "normal" | "alternate" | "growth" | "spawn")
            }
            className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded w-full"
          >
            <option value="normal">Normal</option>
            <option value="alternate">Alternate</option>
            <option value="growth">Growth</option>
            <option value="spawn">Spawn</option>
          </select>
        </div>
        {/* Gravity Slider (hidden in spawn mode if desired) */}
        {mode !== "spawn" && (
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
        )}
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
        {/* Number of Walls Slider (hidden in Growth/Spawn modes) */}
        {mode !== "growth" && mode !== "spawn" && (
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
        {/* Remove Wall on Pass Checkbox (hidden in Growth/Spawn modes) */}
        {mode !== "growth" && mode !== "spawn" && (
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
        {/* Trail Fade Slider (hidden in Growth/Spawn modes) */}
        {mode !== "growth" && mode !== "spawn" && (
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
