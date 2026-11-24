import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner (shadcn convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Human-friendly relative time, e.g. "8 months ago". */
export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (!Number.isFinite(d.getTime())) return "Date unavailable";
  const seconds = (d.getTime() - Date.now()) / 1000;
  if (Math.abs(seconds) < 60) return seconds > 0 ? "in a moment" : "just now";
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [31536000, "year"],
    [2592000, "month"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];
  for (const [size, unit] of units) {
    if (Math.abs(seconds) >= size) {
      return new Intl.RelativeTimeFormat("en", { numeric: "always" }).format(
        Math.trunc(seconds / size),
        unit,
      );
    }
  }
  return "just now";
}

/** Safely parse a Prisma `Json` field into a typed value with a fallback. */
export function fromJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  return value as T;
}
