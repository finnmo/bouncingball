// src/helpers/particles.ts
import type { CircleWall } from "./walls";
import { TWO_PI } from "./utils";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
}

export function createShatterParticles(
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

export function createFireworkParticles(cx: number, cy: number, count: number = 100): Particle[] {
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
