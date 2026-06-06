"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Building2,
  MessageSquare,
  Sparkles,
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
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-background px-6 py-7">
      <Link href="/" className="mb-12 block">
        <span className="font-serif text-lg tracking-tight text-foreground">
          VC Memory
        </span>
      </Link>

      <p className="label-eyebrow mb-4 px-3">Workspace</p>
      <nav className="flex flex-col">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center gap-3 py-2.5 pl-3 text-sm transition-colors duration-200",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 bg-accent" />
              )}
              <Icon
                className={cn(
                  "h-[18px] w-[18px]",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
                strokeWidth={1.5}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <p className="label-eyebrow mt-auto px-3">Institutional memory</p>
    </aside>
  );
}
