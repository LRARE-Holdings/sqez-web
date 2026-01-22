"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export default function OnboardingAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setSignedIn(Boolean(u));
      setReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (signedIn) return;

    // Preserve the exact onboarding URL they tried to access
    const full =
      pathname + (search?.toString() ? `?${search.toString()}` : "");
    router.replace(`/auth?next=${encodeURIComponent(full)}`);
  }, [ready, signedIn, router, pathname, search]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0a1a2f] text-[#eaeaea] flex items-center justify-center px-6">
        <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="text-sm font-semibold text-white">Preparing onboarding…</div>
          <div className="mt-2 text-sm text-white/70">Checking your sign-in status.</div>
        </div>
      </div>
    );
  }

  if (!signedIn) return null; // we’re redirecting
  return <>{children}</>;
}