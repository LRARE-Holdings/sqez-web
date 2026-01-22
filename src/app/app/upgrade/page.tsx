"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";

type Status = "checking-auth" | "waiting-entitlement" | "active" | "error";

function markOnboardingComplete() {
  try {
    localStorage.setItem("sqez_onboarding_complete", "true");
  } catch {
    // ignore
  }
}

export default function UpgradePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<Status>("checking-auth");
  const [detail, setDetail] = useState<string>("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/auth?next=%2Fapp%2Fupgrade");
        return;
      }

      setStatus("waiting-entitlement");

      const ref = doc(db, "users", user.uid, "subscription", "current");
      const unsubDoc = onSnapshot(
        ref,
        (snap) => {
          const data = snap.data() as any;

          if (data?.isPro === true) {
            markOnboardingComplete();
            setStatus("active");

            // Optional: auto-redirect after a short beat
            setTimeout(() => {
              router.replace("/app");
            }, 900);
            return;
          }

          setDetail("Finalising your upgrade… this can take a few seconds.");
        },
        (err) => {
          console.error(err);
          setStatus("error");
          setDetail("We couldn’t confirm your upgrade yet. Please refresh.");
        },
      );

      return () => unsubDoc();
    });

    return () => unsub();
  }, [router]);

  return (
    <div className="min-h-dvh bg-[#0a1a2f] text-[#eaeaea] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-semibold">SQEz Pro</div>
          {sessionId ? (
            <div className="text-[11px] text-white/50">session: {sessionId}</div>
          ) : null}
        </div>

        {status === "waiting-entitlement" || status === "checking-auth" ? (
          <>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              You&apos;re almost in.
            </h1>
            <p className="mt-2 text-sm text-white/75">
              {detail || "Confirming your subscription…"}
            </p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
              If you&apos;re seeing this for more than ~20 seconds, refresh the
              page — your webhook may still be processing.
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn btn-primary w-full sm:w-auto"
                onClick={() => window.location.reload()}
              >
                Refresh
              </button>
              <Link href="/onboarding/plan" className="btn btn-outline w-full sm:w-auto">
                Back to plan
              </Link>
            </div>
          </>
        ) : null}

        {status === "active" ? (
          <>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              Upgrade confirmed ✅
            </h1>
            <p className="mt-2 text-sm text-white/75">
              Your SQEz Pro access is now active. Redirecting you to the dashboard…
            </p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link href="/app" className="btn btn-primary w-full sm:w-auto">
                Go to dashboard
              </Link>
              <Link href="/app/session" className="btn btn-outline w-full sm:w-auto">
                Start a session
              </Link>
            </div>
          </>
        ) : null}

        {status === "error" ? (
          <>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              We couldn’t confirm yet
            </h1>
            <p className="mt-2 text-sm text-white/75">{detail}</p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn btn-primary w-full sm:w-auto"
                onClick={() => window.location.reload()}
              >
                Refresh
              </button>
              <Link href="/app" className="btn btn-outline w-full sm:w-auto">
                Go to app
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}