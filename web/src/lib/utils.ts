import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTs(ms: number): string {
  return new Date(ms).toLocaleString();
}

export function formatDuration(startMs: number, endMs: number | null): string {
  if (!endMs) return "—";
  const s = Math.round((endMs - startMs) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}
