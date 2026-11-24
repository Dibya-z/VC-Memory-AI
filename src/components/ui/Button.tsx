"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "default" | "sm" | "icon";
  loading?: boolean;
}

const variants = {
  primary: "button-primary",
  secondary: "button-secondary",
  ghost: "button-ghost",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "default",
      loading = false,
      disabled,
      className,
      children,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "button",
          variants[variant],
          size === "sm" && "button-sm",
          size === "icon" && "icon-button",
          className,
        )}
      >
        {loading && (
          <Loader2
            aria-hidden="true"
            className="h-4 w-4 shrink-0 animate-spin"
            strokeWidth={1.5}
          />
        )}
        {children}
      </button>
    );
  },
);
