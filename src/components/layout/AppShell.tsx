"use client";

import { useRef, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

/** A sticky desktop sidebar and one document scroller; mobile uses a modal drawer. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex min-h-screen">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Sidebar
        open={navOpen}
        onClose={() => setNavOpen(false)}
        returnFocusRef={menuRef}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          onMenu={() => setNavOpen(true)}
          menuOpen={navOpen}
          menuRef={menuRef}
        />
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 px-5 py-8 focus:outline-none md:px-10 md:py-14 lg:px-16"
        >
          <div className="mx-auto max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
