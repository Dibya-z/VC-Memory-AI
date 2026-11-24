import React from "react";
import { cn, timeAgo } from "@/lib/utils";

export function DateTime({
  value,
  label,
  relative = false,
  className,
}: {
  value: string | Date;
  label?: string;
  relative?: boolean;
  className?: string;
}) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime()))
    return (
      <span className={className}>
        {label ? `${label}: ` : ""}Date unavailable
      </span>
    );
  const exact = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
  const visible = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return (
    <time
      className={cn("[overflow-wrap:anywhere]", className)}
      dateTime={date.toISOString()}
      title={exact}
      suppressHydrationWarning={relative}
    >
      {label ? `${label}: ` : ""}
      {relative ? timeAgo(date) : visible}
    </time>
  );
}
