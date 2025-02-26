// src/helpers/ball.ts
import { POST_COLLISION_OFFSET } from "./utils";

export class Ball {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  color: string; // optional color

  constructor(x: number, y: number, radius: number, vx: number, vy: number, color: string = "") {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
  }

  // Standard update (used in non-spawn modes) applies gravity.
  update(dt: number, gravity: number) {
    this.vy += gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  // For spawn mode, use this if you want to update without gravity.
  updatePosition(dt: number) {
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

  draw(ctx: CanvasRenderingContext2D, fallbackColor: string = "#ffa500") {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color || fallbackColor;
    ctx.fill();
  }
}
