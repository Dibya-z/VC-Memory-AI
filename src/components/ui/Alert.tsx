import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Alert({
  variant = "info",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: "error" | "info" | "success";
}) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      {...props}
      className={cn(
        "status-message",
        variant === "error" && "border-danger text-danger",
        variant === "success" && "border-success text-success",
        className,
      )}
    >
      {children}
    </div>
  );
}
