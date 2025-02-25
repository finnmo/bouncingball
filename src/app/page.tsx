"use client";

import React, { useRef, useEffect, useState } from "react";

interface CircleLayer {
  id: number;
  radius: number;
  rotation: number;
  rotationSpeed: number;
}

// 10% gap => ~0.6283 radians
const GAP_ANGLE = (36 * Math.PI) / 180;
const COLLISION_PAD = 2;   // So collisions happen slightly early
const CAP_LEN = 5;         // Short radial cap, 2.5 inside, 2.5 outside
const HALF_CAP = CAP_LEN * 0.5;
const POST_COLLISION_OFFSET = 0.5; // Nudge the ball off boundary after collision

const LARGEST_RADIUS = 260;
const SMALLEST_RADIUS = 60;
const MIN_LINES = 1;
const MAX_LINES = 20;

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ------------------------------
  // 1) USER CONTROLS
  // ------------------------------
  const [gravity, setGravity] = useState(0.1);
  const [ballRadius, setBallRadius] = useState(10);

  // Default number of circles to 10
  const [numLines, setNumLines] = useState(10);

  const [removeCircleOnPass, setRemoveCircleOnPass] = useState(false);

  // Default the trail fade to 0.2
  const [fadeStrength, setFadeStrength] = useState(0.2);

  const [layers, setLayers] = useState<CircleLayer[]>([]);

  // Generate circle layers whenever numLines changes
  useEffect(() => {
    setLayers(generateLayers(numLines));
  }, [numLines]);

  function generateLayers(count: number): CircleLayer[] {
    if (count <= 0) return [];
    if (count === 1) {
      return [
        { id: 0, radius: LARGEST_RADIUS, rotation: 0, rotationSpeed: 0.005 },
      ];
    }
    const arr: CircleLayer[] = [];
    const step = (LARGEST_RADIUS - SMALLEST_RADIUS) / (count - 1);
    for (let i = 0; i < count; i++) {
      const r = SMALLEST_RADIUS + step * i;
      const speed = 0.003 + 0.002 * ((i % 2 === 0 ? 1 : -1) * i);
      arr.push({
        id: i,
        radius: r,
        rotation: 0,
        rotationSpeed: speed,
      });
    }
    return arr;
  }

  // ------------------------------
  // 2) ANIMATION
  // ------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    const cw = canvas.width;
    const ch = canvas.height;
    const cx = cw / 2;
    const cy = ch / 2;

    // BALL
    let x = cx;
    let y = cy;
    let vx = 2;
    let vy = 0;

    let localLayers = layers.map((l) => ({ ...l }));

    /** Perfectly elastic reflection */
    function reflectVelocity(vxIn: number, vyIn: number, nx: number, ny: number) {
      const dot = vxIn * nx + vyIn * ny;
      const rx = vxIn - 2 * dot * nx;
      const ry = vyIn - 2 * dot * ny;
      return [rx, ry];
    }

    /** Check if angle is within the circle's gap [rotation, rotation+GAP_ANGLE). */
    function isInGap(angle: number, rotation: number): boolean {
      const a = (angle + 2 * Math.PI) % (2 * Math.PI);
      const start = (rotation + 2 * Math.PI) % (2 * Math.PI);
      const diff = (a - start + 2 * Math.PI) % (2 * Math.PI);
      return diff < GAP_ANGLE;
    }

    function render() {
      if(!ctx) return;
      // a) Partially erase the old frame for the ball’s trail
      ctx.fillStyle = `rgba(0,0,0,${fadeStrength})`;
      ctx.fillRect(0, 0, cw, ch);

      // b) Redraw circles at full opacity => no streak on them
      localLayers.forEach((layer) => {
        layer.rotation += layer.rotationSpeed;
      });
      drawAllCircles(ctx, cx, cy, localLayers);

      // c) Gravity + Move
      vy += gravity;
      const oldX = x;
      const oldY = y;
      x += vx;
      y += vy;

      // Distances
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      const oldDx = oldX - cx;
      const oldDy = oldY - cy;
      const oldDist = Math.sqrt(oldDx * oldDx + oldDy * oldDy);

      let collidedThisFrame = false;

      // d) Check circle boundary collisions
      for (let i = 0; i < localLayers.length; i++) {
        if (collidedThisFrame) break;

        const layer = localLayers[i];
        const { radius, rotation } = layer;

        // boundaryIn / boundaryOut with collision pad
        const boundaryIn = radius - ballRadius - COLLISION_PAD;
        const boundaryOut = radius + ballRadius + COLLISION_PAD;

        // Cross detection
        const wasInsideIn = oldDist < boundaryIn;
        const isInsideIn = dist < boundaryIn;
        const crossedInOut = wasInsideIn && !isInsideIn;
        const crossedInIn = !wasInsideIn && isInsideIn;

        const wasInsideOut = oldDist < boundaryOut;
        const isInsideOut = dist < boundaryOut;
        const crossedOutOut = wasInsideOut && !isInsideOut;
        const crossedOutIn = !wasInsideOut && isInsideOut;

        const boundaryCrossings = [
          { crossed: crossedInOut, which: "inOut" },
          { crossed: crossedInIn, which: "inIn" },
          { crossed: crossedOutOut, which: "outOut" },
          { crossed: crossedOutIn, which: "outIn" },
        ];

        for (const b of boundaryCrossings) {
          if (!b.crossed) continue;

          if (!isInGap(angle, rotation)) {
            // revert + reflect
            x = oldX;
            y = oldY;
            const ndx = x - cx;
            const ndy = y - cy;
            const nDist = Math.sqrt(ndx * ndx + ndy * ndy);
            if (nDist > 0) {
              const nx = ndx / nDist;
              const ny = ndy / nDist;
              [vx, vy] = reflectVelocity(vx, vy, nx, ny);

              // nudge so no freezing
              x += POST_COLLISION_OFFSET * nx;
              y += POST_COLLISION_OFFSET * ny;
            }
            collidedThisFrame = true;
            break;
          } else {
            // passes through gap
            if (removeCircleOnPass) {
              localLayers = localLayers.filter((ly) => ly.id !== layer.id);
            }
          }
        }
      }

      // e) Collisions with radial caps at angles (rotation) + (rotation+GAP_ANGLE)
      if (!collidedThisFrame) {
        for (let i = 0; i < localLayers.length; i++) {
          if (collidedThisFrame) break;

          const layer = localLayers[i];
          const angles = [layer.rotation, layer.rotation + GAP_ANGLE];
          for (const boundaryAngle of angles) {
            if (
              checkRadialCapCollision(
                oldX,
                oldY,
                x,
                y,
                cx,
                cy,
                boundaryAngle,
                layer.radius,
                ballRadius
              )
            ) {
              // revert + reflect
              x = oldX;
              y = oldY;
              const ndx = x - cx;
              const ndy = y - cy;
              const nDist = Math.sqrt(ndx * ndx + ndy * ndy);
              if (nDist > 0) {
                const nx = ndx / nDist;
                const ny = ndy / nDist;
                [vx, vy] = reflectVelocity(vx, vy, nx, ny);

                x += POST_COLLISION_OFFSET * nx;
                y += POST_COLLISION_OFFSET * ny;
              }
              collidedThisFrame = true;
              break;
            }
          }
        }
      }

      // f) If speed ~ 0 => nudge
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed < 0.0001) {
        vx += (Math.random() - 0.5) * 0.2;
        vy += (Math.random() - 0.5) * 0.2;
      }

      // g) Draw ball
      drawBall(ctx, x, y, ballRadius);

      animationId = requestAnimationFrame(render);
    }

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [gravity, ballRadius, layers, removeCircleOnPass, fadeStrength]);

  // ------------------------------
  // 3) RESPONSIVE UI LAYOUT
  // ------------------------------
  return (
    <main
      className="
        min-h-screen bg-black 
        flex 
        flex-col 
        md:flex-row 
        p-4
      "
    >
      {/* Canvas Area */}
      <div 
        className="
          flex-1 
          flex 
          items-center 
          justify-center 
          mb-4 md:mb-0
        "
      >
        <canvas 
          ref={canvasRef} 
          width={600} 
          height={600} 
          className="bg-black"
        />
      </div>

      {/* Controls Area */}
      <div 
        className="
          w-full 
          md:w-72 
          md:ml-4
          text-white 
          flex 
          flex-col 
          gap-4
        "
      >
        <div>
          <label className="block mb-1 text-sm">
            Gravity: {gravity.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="0.5"
            step="0.01"
            value={gravity}
            onChange={(e) => setGravity(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block mb-1 text-sm">
            Ball Radius: {ballRadius}
          </label>
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
          <label className="block mb-1 text-sm">
            Number of Circles: {numLines}
          </label>
          <input
            type="range"
            min={MIN_LINES}
            max={MAX_LINES}
            step="1"
            value={numLines}
            onChange={(e) => setNumLines(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="removeCircleOnPass"
            checked={removeCircleOnPass}
            onChange={(e) => setRemoveCircleOnPass(e.target.checked)}
          />
          <label htmlFor="removeCircleOnPass" className="text-sm">
            Remove Circle When Ball Passes Gap
          </label>
        </div>

        <div>
          <label className="block mb-1 text-sm">
            Trail Fade: {fadeStrength.toFixed(2)}
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
          <p className="text-xs opacity-80">
            0 = permanent ghost, 1 = no trail
          </p>
        </div>
      </div>
    </main>
  );
}

/** Draw arcs from (rotation + GAP_ANGLE) => (rotation + 2π) and short radial caps. */
function drawAllCircles(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  layers: CircleLayer[]
) {
  ctx.save();
  ctx.strokeStyle = "white";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  for (const layer of layers) {
    // main arc
    const startAngle = layer.rotation + GAP_ANGLE;
    const endAngle = layer.rotation + 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, layer.radius, startAngle, endAngle, false);
    ctx.stroke();

    // radial caps at angles = (layer.rotation) & (layer.rotation + GAP_ANGLE)
    const angles = [layer.rotation, layer.rotation + GAP_ANGLE];
    for (const boundaryAngle of angles) {
      drawRadialCap(ctx, cx, cy, layer.radius, boundaryAngle);
    }
  }

  ctx.restore();
}

/** Short radial cap line is 5 px total, half inside and half outside circle radius. */
function drawRadialCap(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  angle: number
) {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  const startR = r - HALF_CAP; // center of line is at radius=r
  const endR = r + HALF_CAP;

  const sx = cx + startR * cosA;
  const sy = cy + startR * sinA;
  const ex = cx + endR * cosA;
  const ey = cy + endR * sinA;

  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
}

/** Draw the ball. */
function drawBall(ctx: CanvasRenderingContext2D, bx: number, by: number, br: number) {
  ctx.beginPath();
  ctx.arc(bx, by, br, 0, 2 * Math.PI);
  ctx.fillStyle = "orange";
  ctx.fill();
}

/** 
 * We define a radial cap line from (r - 2.5) to (r + 2.5) at 'boundaryAngle'.
 * If ball’s new center is within ballRadius => collision.
 */
function checkRadialCapCollision(
  oldX: number, oldY: number,
  newX: number, newY: number,
  cx: number, cy: number,
  boundaryAngle: number,
  r: number,
  ballR: number
): boolean {
  const cosA = Math.cos(boundaryAngle);
  const sinA = Math.sin(boundaryAngle);

  const startR = r - HALF_CAP;
  const endR   = r + HALF_CAP;

  const sx = cx + startR*cosA;
  const sy = cy + startR*sinA;
  const ex = cx + endR*cosA;
  const ey = cy + endR*sinA;

  const dist = distPointToSegment(newX, newY, sx, sy, ex, ey);
  return dist <= ballR;
}

/** distance from point(px,py) to line segment(sx,sy)->(ex,ey). */
function distPointToSegment(
  px: number, py: number,
  sx: number, sy: number,
  ex: number, ey: number
): number {
  const vx = ex - sx;
  const vy = ey - sy;
  const wx = px - sx;
  const wy = py - sy;

  const segLen2 = vx*vx + vy*vy;
  if (segLen2 < 1e-8) {
    // segment is basically a point
    return Math.sqrt(wx*wx + wy*wy);
  }

  const dot = wx*vx + wy*vy;
  const t = dot / segLen2;

  let closestX, closestY;
  if (t <= 0) {
    closestX = sx;
    closestY = sy;
  } else if (t >= 1) {
    closestX = ex;
    closestY = ey;
  } else {
    closestX = sx + t*vx;
    closestY = sy + t*vy;
  }

  const dx = px - closestX;
  const dy = py - closestY;
  return Math.sqrt(dx*dx + dy*dy);
}
