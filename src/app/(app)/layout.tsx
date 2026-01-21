"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/app/Sidebar";
import { Topbar } from "@/components/app/Topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);

  const closeNav = () => setNavOpen(false);
  const openNav = () => setNavOpen(true);

  // Lock background scroll when drawer is open
  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  // Close on Escape
  useEffect(() => {
    if (!navOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNav();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navOpen]);

  const overlayClass = useMemo(() => {
    return [
      "fixed inset-0 z-40 lg:hidden",
      navOpen ? "pointer-events-auto" : "pointer-events-none",
    ].join(" ");
  }, [navOpen]);

  return (
    <main className="min-h-dvh">
      <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[280px_1fr]">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Mobile drawer */}
        <div className={overlayClass} aria-hidden={!navOpen}>
          {/* Backdrop */}
          <div
            className={[
              "absolute inset-0 bg-black/55 backdrop-blur-[1px] transition-opacity",
              navOpen ? "opacity-100" : "opacity-0",
            ].join(" ")}
            onClick={closeNav}
          />

          {/* Drawer */}
          <div
            className={[
              "absolute left-0 top-0 h-full w-[86%] max-w-[320px]",
              "transition-transform duration-200 ease-out",
              navOpen ? "translate-x-0" : "-translate-x-full",
            ].join(" ")}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <Sidebar onClose={closeNav} />
          </div>
        </div>

        {/* Main */}
        <div className="min-w-0">
          <Topbar onOpenNav={openNav} />

          <div className="px-4 py-6">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}