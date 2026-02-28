"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";

type UserDoc = {
  isPro?: boolean;
  subscriptionTier?: string;
  betaUnlimited?: boolean;
};

type GateState =
  | { kind: "loading" }
  | { kind: "ready"; user: User; doc: UserDoc | null }
  | { kind: "error"; user: User };

export function ProGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [state, setState] = useState<GateState>({ kind: "loading" });

  const allowWithoutPro = useMemo(() => {
    const p = pathname || "";
    return (
      p.startsWith("/app/upgrade") ||
      p.startsWith("/app/not-pro") ||
      p.startsWith("/app/account") ||
      p.startsWith("/app/app/account")
    );
  }, [pathname]);

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;

    const unsub = onAuthStateChanged(auth, (u) => {
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }

      if (!u) {
        const next = encodeURIComponent(pathname || "/app");
        router.replace(`/auth?next=${next}`);
        return;
      }

      // We have a user, but we still need to confirm entitlement from Firestore.
      setState({ kind: "loading" });

      const ref = doc(db, "users", u.uid);
      unsubDoc = onSnapshot(
        ref,
        (snap) => {
          const data = (snap.data() as UserDoc) || null;
          setState({ kind: "ready", user: u, doc: data });
        },
        (err) => {
          // IMPORTANT:
          // Do NOT treat Firestore read failures as "not Pro".
          // During MFA / token refresh / transient rule issues, this can incorrectly
          // bounce paid users to /app/not-pro.
          console.error("ProGate snapshot error", err);
          setState({ kind: "error", user: u });
        },
      );

    });

    return () => {
      if (unsubDoc) {
        unsubDoc();
      }
      unsub();
    };
  }, [router, pathname]);

  useEffect(() => {
    if (state.kind !== "ready") return;

    const userDoc = state.doc;

    // Single source of truth: users/{uid}.isPro
    const isPro =
      Boolean(userDoc?.isPro) ||
      Boolean(userDoc?.betaUnlimited);

    if (!isPro && !allowWithoutPro) {
      router.replace("/app/not-pro");
    }
  }, [state, allowWithoutPro, router]);

  if (state.kind === "loading") {
    return (
      <div className="min-h-dvh bg-[#0a1a2f] text-[#eaeaea] flex items-center justify-center px-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-white/80">
          Loading…
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    // Keep the user in-app and let them retry, rather than falsely denying.
    return (
      <div className="min-h-dvh bg-[#0a1a2f] text-[#eaeaea] flex items-center justify-center px-6">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 px-6 py-6">
          <div className="text-sm font-semibold">Can’t confirm Pro access yet</div>
          <div className="mt-2 text-sm text-white/75">
            We couldn’t read your account entitlement from Firestore. This is usually
            temporary (token refresh / network). Please refresh.
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn btn-primary w-full sm:w-auto"
              onClick={() => window.location.reload()}
            >
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-outline w-full sm:w-auto"
              onClick={() => router.replace("/app/account")}
            >
              Go to account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // state.kind === "ready"
  return <>{children}</>;
}
