"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";

type UserDoc = {
  isPro?: boolean;
  subscriptionTier?: string;
  betaUnlimited?: boolean;
};

export function ProGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [ready, setReady] = useState(false);

  const allowWithoutPro = useMemo(() => {
    const p = pathname || "";
    // Adjust if your account URL is /app/account rather than /app/app/account
return (
  p.startsWith("/app/upgrade") ||
  p.startsWith("/app/not-pro") ||
  p.startsWith("/app/account") ||
  p.startsWith("/app/app/account")
);
  }, [pathname]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        const next = encodeURIComponent(pathname || "/app/upgrade");
        router.replace(`/auth?next=${next}`);
        return;
      }
      setAuthUser(u);
    });

    return () => unsub();
  }, [router, pathname]);

  useEffect(() => {
    if (!authUser) return;

    const ref = doc(db, "users", authUser.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setUserDoc((snap.data() as UserDoc) || null);
        setReady(true);
      },
      () => {
        setUserDoc(null);
        setReady(true);
      },
    );

    return () => unsub();
  }, [authUser]);

  useEffect(() => {
    if (!ready) return;

    // If we can't read the doc, treat as not entitled.
    const isPro =
      Boolean(userDoc?.isPro) ||
      Boolean(userDoc?.betaUnlimited) ||
      String(userDoc?.subscriptionTier || "").toLowerCase().includes("pro");

    if (!isPro && !allowWithoutPro) {
      router.replace("/app/not-pro");
    }
  }, [ready, userDoc, allowWithoutPro, router]);

  if (!ready) {
    return (
      <div className="min-h-dvh bg-[#0a1a2f] text-[#eaeaea] flex items-center justify-center px-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-white/80">
          Loading…
        </div>
      </div>
    );
  }

  // If not pro and this route is allowed, show it.
  // If not pro and route is not allowed, we already redirected.
  return <>{children}</>;
}