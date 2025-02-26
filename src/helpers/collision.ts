// src/helpers/collision.ts
import { isAngleInGap, pointToSegmentDistance, HALF_CAP, COLLISION_PAD } from "./utils";
import type { CircleWall } from "./walls";
import { Ball } from "./ball";

export function checkArcCollision(
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

export function checkRadialCap(
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
