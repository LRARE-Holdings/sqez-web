"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";

type GateState =
  | { kind: "loading" }
  | { kind: "authed"; onboardingCompleted: boolean }
  | { kind: "unauthed" };

function isPublicPath(pathname: string) {
  // Public pages: landing + legal + auth + onboarding itself
  if (pathname === "/") return true;
  if (pathname.startsWith("/legal")) return true;

  if (pathname.startsWith("/auth")) return true;
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/signup")) return true;

  // Onboarding pages must never gate themselves
  if (pathname.startsWith("/onboarding")) return true;

  return false;
}

function isAppExemptPath(pathname: string) {
  // Allow Stripe return confirmation page through even if onboarding isn't complete
  if (pathname.startsWith("/app/upgrade")) return true;
  return false;
}

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [state, setState] = useState<GateState>({ kind: "loading" });

  useEffect(() => {
    // If you're on a public page, do not gate at all.
    if (isPublicPath(pathname)) return;

    // For /app routes we require auth + onboardingCompleted (except upgrade page)
    if (!pathname.startsWith("/app")) return;

    if (isAppExemptPath(pathname)) return;

    // IMPORTANT: manage the Firestore unsubscribe ourselves.
    // Returning a cleanup function from the onAuthStateChanged callback does NOT work.
    let unsubDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Always tear down any prior doc listener when auth changes.
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }

      if (!user) {
        setState({ kind: "unauthed" });
        const next = encodeURIComponent(pathname);
        router.replace(`/auth?next=${next}`);
        return;
      }

      // While we (re)attach the snapshot listener, keep loading.
      setState({ kind: "loading" });

      // User is authed → watch Firestore for onboardingCompleted
      const userRef = doc(db, "users", user.uid);

      unsubDoc = onSnapshot(
        userRef,
        (snap) => {
          const data = snap.data() as any;
          const onboardingCompleted = data?.onboardingCompleted === true;

          setState({ kind: "authed", onboardingCompleted });

          if (!onboardingCompleted) {
            router.replace("/onboarding");
          }
        },
        (err) => {
          console.error("OnboardingGate snapshot error", err);
          // Do NOT force a redirect on transient errors.
          // Keep gate in loading so we don't bounce already-onboarded users.
          setState({ kind: "loading" });
        },
      );
    });

    return () => {
      if (unsubDoc) unsubDoc();
      unsubAuth();
    };
  }, [pathname, router]);

  // Only block rendering for gated /app routes (avoid blanking public pages)
  const shouldGate = pathname.startsWith("/app") && !isAppExemptPath(pathname);

  if (!shouldGate) return <>{children}</>;

  if (state.kind === "loading") {
    return (
      <div className="min-h-dvh bg-[#0a1a2f] text-[#eaeaea] flex items-center justify-center px-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-white/80">
          Loading…
        </div>
      </div>
    );
  }

  // If unauthed or not completed, router redirects. Render nothing to avoid flicker.
  if (state.kind === "unauthed") return null;
  if (state.kind === "authed" && !state.onboardingCompleted) return null;

  return <>{children}</>;
}