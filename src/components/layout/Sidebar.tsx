"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Building2,
  MessageSquare,
  Sparkles,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/companies", label: "Company Memory", icon: Building2 },
  { href: "/chat", label: "Memory Chat", icon: MessageSquare },
  { href: "/analyzer", label: "Deal Analyzer", icon: Sparkles },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-secondary/30 px-3 py-5">
      <div className="mb-6 flex items-center gap-2 px-2">
        <Brain className="h-6 w-6 text-accent" />
        <span className="text-sm font-semibold tracking-tight">
          VC Memory AI
        </span>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-3 text-xs text-muted-foreground">
        Institutional memory, searchable.
      </div>
    </aside>
  );
}
