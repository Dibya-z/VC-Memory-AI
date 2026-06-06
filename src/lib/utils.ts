import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner (shadcn convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Human-friendly relative time, e.g. "8 months ago". */
export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  const units: [number, string][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [30, "day"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];
  let value = seconds;
  let unit = "second";
  for (const [step, name] of units) {
    if (Math.abs(value) < step) {
      unit = name;
      break;
    }
    value = Math.floor(value / step);
    unit = name;
  }
  const rounded = Math.max(1, Math.abs(value));
  return `${rounded} ${unit}${rounded === 1 ? "" : "s"} ago`;
}

/** Safely parse a Prisma `Json` field into a typed value with a fallback. */
export function fromJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  return value as T;
}
