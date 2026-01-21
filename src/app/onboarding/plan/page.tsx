"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { recommendPlan } from "@/lib/onboarding/store";

const WEB_MONTHLY = "£14.99 / month";
const WEB_ANNUAL = "£79.99 / year";

function PlanCard({
  title,
  price,
  highlight,
  subtitle,
  cta,
  onClick,
}: {
  title: string;
  price: string;
  subtitle: string;
  highlight?: boolean;
  cta: string;
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

      <button type="button" className="btn btn-primary mt-5 w-full" onClick={onClick}>
        {cta}
      </button>
    </div>
  );
}

export default function PlanPage() {
  const router = useRouter();
  const { answers } = useOnboarding();

  const rec = useMemo(() => recommendPlan(answers.examWindow), [answers.examWindow]);

  function markOnboardingComplete() {
    try {
      localStorage.setItem("sqez_onboarding_complete", "true");
    } catch {
      // ignore
    }
  }

  // In the real build, these buttons should call your Stripe checkout session endpoint
  // and pass plan identifiers.
  function startCheckout(plan: "MONTHLY" | "ANNUAL") {
    markOnboardingComplete();
    // TODO: replace with Stripe Checkout creation
    // router.push(`/pay?plan=${plan}`);
    router.push("/app"); // placeholder: don’t block product access during build
    void plan;
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
            onClick={() => startCheckout("ANNUAL")}
          />

          <PlanCard
            title="SQEz Pro — Monthly"
            price={WEB_MONTHLY}
            subtitle="Best for short timelines or flexibility. Cancel anytime."
            highlight={rec.kind === "MONTHLY"}
            cta="Choose monthly"
            onClick={() => startCheckout("MONTHLY")}
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm font-semibold text-white">Not ready to pay yet?</div>
          <div className="mt-2 text-sm text-white/70">
            You can start with SQEz and upgrade anytime.
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/app"
              className="btn btn-outline w-full sm:w-auto"
              onClick={markOnboardingComplete}
            >
              Continue to dashboard
            </Link>
            <Link
              href="/app/session"
              className="btn btn-ghost w-full sm:w-auto"
              onClick={markOnboardingComplete}
            >
              Start a quick session
            </Link>
          </div>
        </div>
      </div>
    </OnboardingShell>
  );
}