"use client";

import Link from "next/link";

export function Topbar({ onOpenNav }: { onOpenNav?: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a1a2f]/75 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2">
          {onOpenNav ? (
            <button
              type="button"
              className="btn btn-ghost px-3 py-2 lg:hidden"
              onClick={onOpenNav}
              aria-label="Open navigation"
            >
              Menu
            </button>
          ) : null}

          {/* Mobile: show logo */}
          <Link
            href="/"
            className="flex items-center gap-3 lg:hidden"
            aria-label="SQEz home"
          >
            <img src="/SQEz-logo.svg" alt="SQEz" className="h-5 w-auto" />
            <span className="sr-only">SQEz</span>
          </Link>

          {/* Desktop: small descriptor */}
          <div className="hidden lg:block">
            <div className="text-sm font-semibold tracking-tight text-white">
              Dashboard
            </div>
            <div className="text-xs text-white/60">
              Today, insights, and progress
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link className="btn btn-ghost px-3 py-2" href="/#pricing">
            Pricing
          </Link>
          <Link className="btn btn-outline px-3 py-2" href="/auth">
            Account
          </Link>
        </div>
      </div>
    </header>
  );
}