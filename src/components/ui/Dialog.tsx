"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useHydrated } from "@/lib/client/use-hydrated";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  id?: string;
  description?: string;
  variant?: "dialog" | "drawer";
  className?: string;
  panelClassName?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/** Native modal semantics provide background inertness and focus containment. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  id,
  description,
  variant = "dialog",
  className,
  panelClassName,
  initialFocusRef,
  returnFocusRef,
}: DialogProps) {
  const generatedId = useId();
  const titleId = `${id ?? generatedId}-title`;
  const descriptionId = `${id ?? generatedId}-description`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const mounted = useHydrated();
  useEffect(() => {
    if (!mounted || !open || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const returnTarget = returnFocusRef?.current ?? previousFocus;
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    const previousScrollY = window.scrollY;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    (initialFocusRef?.current ?? panelRef.current)?.focus({
      preventScroll: true,
    });

    return () => {
      dialog.close();
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      // Restore the same reading position rather than scrolling to the trigger.
      window.scrollTo({
        top: previousScrollY,
        behavior: "instant" as ScrollBehavior,
      });
      const target = returnTarget;
      if (target?.isConnected && target.getClientRects().length > 0)
        target.focus({ preventScroll: true });
    };
  }, [mounted, open, initialFocusRef, returnFocusRef]);

  if (!mounted || !open) return null;
  return createPortal(
    <dialog
      ref={dialogRef}
      id={id}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-modal="true"
      className={cn(
        "ui-dialog",
        variant === "drawer" && "ui-drawer",
        className,
      )}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'a[href],button:not(:disabled),input:not(:disabled):not([type="hidden"]),textarea:not(:disabled),select:not(:disabled),summary,[tabindex]:not([tabindex="-1"])',
          ),
        ).filter(
          (element) =>
            element.getClientRects().length > 0 &&
            !element.closest("[hidden],[inert]"),
        );
        const first = controls[0],
          last = controls[controls.length - 1];
        if (!first) {
          event.preventDefault();
          panelRef.current?.focus();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === panelRef.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn("dialog-panel", panelClassName)}
      >
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="sr-only">
            {description}
          </p>
        )}
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
