"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";
import { isPasswordUser } from "@/lib/auth/mfa";

export default function OnboardingAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const nextTarget = useMemo(() => {
    const path = pathname || "/onboarding";
    const qs = searchParams?.toString();
    return qs ? `${path}?${qs}` : path;
  }, [pathname, searchParams]);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setReady(false);
      const nextUrl = encodeURIComponent(nextTarget);

      // Must be signed in
      if (!user) {
        router.replace(`/auth?next=${nextUrl}`);
        return;
      }

      // Password users must verify email BEFORE onboarding
      if (isPasswordUser(user) && !user.emailVerified) {
        try {
          await user.reload();
        } catch {
          // ignore reload failures; we still check emailVerified as-is
        }

        if (!user.emailVerified) {
          router.replace(`/verify-email?next=${nextUrl}`);
          return;
        }
      }

      // Phase 2: Names required before onboarding (single source of truth: Firestore)
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.exists() ? (snap.data() as any) : null;

        const firstName = typeof data?.firstName === "string" ? data.firstName.trim() : "";
        const lastName = typeof data?.lastName === "string" ? data.lastName.trim() : "";

        if (!firstName || !lastName) {
          router.replace(`/name?next=${nextUrl}`);
          return;
        }
      } catch {
        // If we can't read the user doc, keep the gate closed and send to auth
        // (most likely a permission/auth state mismatch).
        router.replace(`/auth?next=${nextUrl}`);
        return;
      }

      // MFA is optional (do NOT block onboarding)
      setReady(true);
    });

    return () => unsub();
  }, [router, nextTarget]);

  if (!ready) {
    return (
      <div className="min-h-dvh bg-[#0a1a2f] text-[#eaeaea] flex items-center justify-center px-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-white/80">
          Loading…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}