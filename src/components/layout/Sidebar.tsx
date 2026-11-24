"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type RefObject } from "react";
import {
  LayoutDashboard,
  Upload,
  Building2,
  MessageSquare,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/companies", label: "Company Memory", icon: Building2 },
  { href: "/chat", label: "Memory Chat", icon: MessageSquare },
  { href: "/analyzer", label: "Deal Analyzer", icon: Sparkles },
];

export function Sidebar({
  open = false,
  onClose,
  returnFocusRef,
}: {
  open?: boolean;
  onClose?: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches && open) onClose?.();
    };
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [open, onClose]);
  return (
    <>
      {/* Desktop: persistent sidebar (unchanged on lg+) */}
      <aside className="app-sidebar sticky top-0 hidden h-dvh w-64 shrink-0 self-start flex-col overflow-y-auto border-r border-border bg-background px-6 py-7 lg:flex">
        <SidebarNav />
      </aside>

      {/* Mobile / tablet: slide-in drawer */}
      <Dialog
        open={open}
        onClose={() => onClose?.()}
        id="workspace-menu"
        title="Workspace navigation"
        variant="drawer"
        initialFocusRef={closeRef}
        returnFocusRef={returnFocusRef}
      >
        <Button
          ref={closeRef}
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close menu"
          className="absolute right-2 top-2"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </Button>
        <SidebarNav onNavigate={onClose} />
      </Dialog>
    </>
  );
}

/** Shared nav body, rendered in both the desktop sidebar and the mobile drawer. */
function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      <Link href="/" className="mb-10 block pr-10" onClick={onNavigate}>
        <span className="font-serif text-lg tracking-tight text-foreground">
          VC Memory
        </span>
      </Link>

      <p className="label-eyebrow mb-4 px-3">Workspace</p>
      <nav aria-label="Workspace" className="mb-8 flex flex-col">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 py-2.5 pl-3 text-sm transition-colors duration-200",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 bg-accent" />
              )}
              <Icon
                className={cn(
                  "h-[18px] w-[18px]",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
                strokeWidth={1.5}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <p className="label-eyebrow mt-auto px-3">Institutional memory</p>
    </>
  );
}
