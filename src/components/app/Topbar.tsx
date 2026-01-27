"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Menu } from "lucide-react";

import { auth, db } from "@/lib/firebase/client";

function timeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Topbar({ onOpenNav }: { onOpenNav?: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [firstName, setFirstName] = useState<string>("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u ?? null);

      if (!u) {
        setFirstName("");
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const name =
          typeof snap.data()?.firstName === "string"
            ? snap.data()!.firstName.trim()
            : "";
        setFirstName(name);
      } catch {
        setFirstName("");
      }
    });

    return () => unsub();
  }, []);

  const greeting = useMemo(() => {
    const base = timeGreeting();
    return firstName ? `${base}, ${firstName}` : base;
  }, [firstName]);

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a1a2f]/75 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        {/* Left */}
        <div className="flex items-center gap-3">
          {/* ✅ Mobile hamburger */}
          {onOpenNav ? (
            <button
              type="button"
              onClick={onOpenNav}
              className="btn btn-ghost px-3 py-2 md:!hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
          ) : null}

          {/* Logo (mobile) */}
          <Link
            href="/app"
            className="flex items-center gap-3 md:!hidden"
            aria-label="SQEz home"
          >
            <img src="/sqez-logo.svg" alt="SQEz" className="h-5 w-auto" />
            <span className="sr-only">SQEz</span>
          </Link>

          {/* Greeting (desktop) */}
          <div className="!hidden md:!block">
            <div className="text-sm font-medium text-white">
              {greeting}
            </div>
            <div className="text-xs text-white/60">
              Let’s keep things moving.
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <Link href="/app/account" className="btn btn-ghost px-3 py-2">
            Account
          </Link>

          <button
            type="button"
            className="btn btn-outline px-3 py-2"
            onClick={() => signOut(auth)}
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}