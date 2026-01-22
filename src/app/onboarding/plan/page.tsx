"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { auth } from "@/lib/firebase/client";

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

  const rec = useMemo(() => recommendPlan(answers.examWindow), [answers.examWindow]);

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