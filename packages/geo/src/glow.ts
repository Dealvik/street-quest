import { SOJOURN_SECONDS } from "./constants";
import type { CellKind } from "./types";

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Log scale: a passing block is visible, an hour in one place is fully lit. */
export function coverageIntensity(durationSeconds: number): number {
  if (durationSeconds <= 0) return 0.12;
  const hourish = 45 * 60;
  return clamp01(0.12 + 0.88 * (Math.log1p(durationSeconds) / Math.log1p(hourish)));
}

export function cellKind(durationSeconds: number): CellKind {
  return durationSeconds >= SOJOURN_SECONDS ? "sojourn" : "passage";
}

function mixChannel(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * t);
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function mixHex(from: string, to: string, t: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const amount = clamp01(t);
  return rgbToHex([
    mixChannel(a[0], b[0], amount),
    mixChannel(a[1], b[1], amount),
    mixChannel(a[2], b[2], amount),
  ]);
}

export function styleForIntensity(intensity: number): {
  fill: string;
  line: string;
  opacity: number;
  lineWidth: number;
} {
  const t = clamp01(intensity);
  return {
    fill: mixHex("#1c2a16", "#f4ffd0", t),
    line: mixHex("#6d8a3d", "#ffffff", Math.min(1, t * 1.15)),
    opacity: 0.3 + t * 0.6,
    lineWidth: 1.25 + t * 4.5,
  };
}
