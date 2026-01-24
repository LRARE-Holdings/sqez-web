"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { auth, db } from "@/lib/firebase/client";

import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { recommendPlan } from "@/lib/onboarding/store";
import { writeOnboarding } from "@/lib/onboarding/firestore";

const WEB_MONTHLY = "£14.99 / month";
const WEB_ANNUAL = "£79.99 / year";

function PlanCard({
  title,
  price,
  highlight,
  subtitle,
  cta,
  disabled,
  onClick,
}: {
  title: string;
  price: string;
  subtitle: string;
  highlight?: boolean;
  cta: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={[
        "rounded-3xl border p-6 transition",
        highlight
          ? "border-white/25 bg-white/10"
          : "border-white/10 bg-white/5 hover:bg-white/8",
      ].join(" ")}
    >
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{price}</div>
      <div className="mt-2 text-sm text-white/70">{subtitle}</div>

      <button
        type="button"
        className="btn btn-primary mt-5 w-full"
        onClick={onClick}
        disabled={disabled}
      >
        {disabled ? "Redirecting…" : cta}
      </button>
    </div>
  );
}

export default function PlanPage() {
  const router = useRouter();
  const { answers } = useOnboarding();

  const [loadingPlan, setLoadingPlan] = useState<null | "MONTHLY" | "ANNUAL">(null);
  const [checkingEntitlement, setCheckingEntitlement] = useState(true);

  const rec = useMemo(() => recommendPlan(answers.examWindow), [answers.examWindow]);

  useEffect(() => {
    const user = auth.currentUser;

    // If not signed in, we can't check Firestore entitlement.
    // Allow the page to render (it will push to /auth on checkout).
    if (!user) {
      setCheckingEntitlement(false);
      return;
    }

    const ref = doc(db, "users", user.uid);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as { isPro?: boolean } | undefined;
        const isPro = Boolean(data?.isPro);

        if (isPro) {
          // If already Pro, plan page should never show.
          router.replace("/app");
          return;
        }

        // Not Pro — allow this page to render.
        setCheckingEntitlement(false);

        // Mark onboarding completed (best-effort) once we know they aren't Pro.
        void setDoc(
          ref,
          {
            onboardingCompleted: true,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      },
      (err) => {
        console.error("PlanPage entitlement listener failed", err);
        // Fail open: allow rendering.
        setCheckingEntitlement(false);
      },
    );

    return () => unsub();
  }, [router]);

  async function startCheckout(plan: "MONTHLY" | "ANNUAL") {
    if (loadingPlan) return;

    const user = auth.currentUser;
    if (!user) {
      router.push("/auth?next=%2Fonboarding%2Fplan");
      return;
    }

    setLoadingPlan(plan);

    try {
      const token = await user.getIdToken();

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
      });

      const data = (await res.json()) as { url?: string; error?: string };

      if (data.url) {
        // Persist recommendation + chosen plan in Firestore (single source of truth)
        try {
          await writeOnboarding({
            recommendedPlan: rec.kind,
            runwayMonths: rec.runwayMonths,
            chosenPlan: plan,
          });
        } catch (e) {
          console.error("writeOnboarding(plan) failed", e);
        }

        // Redirect to Stripe Checkout. Onboarding completion is confirmed on /app/upgrade
        // once Firestore entitlement (users/{uid}.isPro) is true.
        window.location.assign(data.url);
        return;
      }

      console.error(data.error || "Stripe checkout failed");
      setLoadingPlan(null);
    } catch (e) {
      console.error(e);
      setLoadingPlan(null);
    }
  }

  if (checkingEntitlement) {
    return (
      <OnboardingShell
        step={6}
        total={6}
        title="Checking your plan…"
        subtitle="Just a moment."
        backHref="/onboarding/background"
      >
        <div className="grid gap-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="h-4 w-40 rounded bg-white/10" />
            <div className="mt-3 h-7 w-56 rounded bg-white/10" />
            <div className="mt-3 h-4 w-full rounded bg-white/10" />
            <div className="mt-6 h-10 w-full rounded bg-white/10" />
          </div>
        </div>
      </OnboardingShell>
    );
  }

  const headline =
    rec.kind === "MONTHLY"
      ? "Monthly is the best fit for your timeline."
      : rec.kind === "ANNUAL"
        ? "Annual is the best value for your study runway."
        : "Most people in your position choose annual — but you can pick either.";

  return (
    <OnboardingShell
      step={6}
      total={6}
      title="Your recommended SQEz plan"
      subtitle={`Based on your timeline. ${headline}`}
      backHref="/onboarding/background"
    >
      <div className="grid gap-4">
        <div className="text-xs text-white/60">
          Recommended runway: <span className="text-white/80">{rec.runwayMonths} months</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <PlanCard
            title="SQEz Pro — Annual"
            price={WEB_ANNUAL}
            subtitle="Best value for longer study periods. Uninterrupted access."
            highlight={rec.kind === "ANNUAL" || rec.kind === "COMPARE"}
            cta="Choose annual"
            disabled={loadingPlan !== null}
            onClick={() => startCheckout("ANNUAL")}
          />

          <PlanCard
            title="SQEz Pro — Monthly"
            price={WEB_MONTHLY}
            subtitle="Best for short timelines or flexibility. Cancel anytime."
            highlight={rec.kind === "MONTHLY"}
            cta="Choose monthly"
            disabled={loadingPlan !== null}
            onClick={() => startCheckout("MONTHLY")}
          />
        </div>
      </div>
    </OnboardingShell>
  );
}