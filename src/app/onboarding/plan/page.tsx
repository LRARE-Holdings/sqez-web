"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { recommendPlan } from "@/lib/onboarding/store";
import { writeOnboarding } from "@/lib/onboarding/firestore";

const PRICE_MONTHLY = 14.99;
const PRICE_ANNUAL = 79.99;

const TRIAL_MONTHLY_DAYS = 14;
const TRIAL_ANNUAL_DAYS = 30;

function formatGBP(n: number) {
  return `£${n.toFixed(2)}`;
}

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type Plan = "MONTHLY" | "ANNUAL";

function PlanOption({
  label,
  plan,
  recommended,
  trialDays,
  primaryLine,
  secondaryLine,
  finePrint,
  disabled,
  onChoose,
}: {
  label: string;
  plan: Plan;
  recommended: boolean;
  trialDays: number;
  primaryLine: string;
  secondaryLine: string;
  finePrint: string;
  disabled: boolean;
  onChoose: (plan: Plan) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChoose(plan)}
      disabled={disabled}
      className={cx(
        "group w-full text-left rounded-2xl border p-4 transition",
        "focus:outline-none focus:ring-2 focus:ring-white/15",
        recommended
          ? "border-emerald-400/35 bg-white/10"
          : "border-white/10 bg-white/5 hover:bg-white/10",
        disabled ? "opacity-70 cursor-not-allowed" : "cursor-pointer",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-white">{label}</div>
            {recommended ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-50">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Recommended
              </span>
            ) : null}
          </div>

          <div className="mt-2 text-sm text-white/85">
            <span className="font-semibold text-white">
              Free trial — {trialDays} days
            </span>
            <span className="text-white/65"> · {primaryLine}</span>
          </div>

          <div className="mt-1 text-xs text-white/60">{secondaryLine}</div>
        </div>

        <div className="shrink-0">
          <span
            className={cx(
              "inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold",
              recommended ? "bg-emerald-400/15 text-emerald-50" : "bg-white/5 text-white/80",
              "group-hover:bg-white/10",
            )}
          >
            {disabled ? "Redirecting…" : "Choose"}
          </span>
        </div>
      </div>

      <div className="mt-3 text-[11px] text-white/50">{finePrint}</div>
    </button>
  );
}

export default function PlanPage() {
  const router = useRouter();
  const { answers } = useOnboarding();

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);

  const [loadingPlan, setLoadingPlan] = useState<null | Plan>(null);
  const [checkingEntitlement, setCheckingEntitlement] = useState(true);

  const rec = useMemo(() => recommendPlan(answers.examWindow), [answers.examWindow]);

  const annualAsMonthly = useMemo(() => PRICE_ANNUAL / 12, []);
  const savingsPct = useMemo(() => {
    const pct = Math.round(((PRICE_MONTHLY - annualAsMonthly) / PRICE_MONTHLY) * 100);
    return Number.isFinite(pct) ? Math.max(0, pct) : 0;
  }, [annualAsMonthly]);

  // 1) Resolve auth properly
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u ?? null);
      setAuthResolved(true);
    });
    return () => unsub();
  }, []);

  // 2) Attach entitlement listener once auth has resolved
  useEffect(() => {
    if (!authResolved) return;

    if (!authUser) {
      setCheckingEntitlement(false);
      return;
    }

    const ref = doc(db, "users", authUser.uid);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as { isPro?: boolean } | undefined;
        const isPro = Boolean(data?.isPro);

        if (isPro) {
          router.replace("/app");
          return;
        }

        setCheckingEntitlement(false);

        // Reaching plan step means onboarding is done (web flow)
        void setDoc(
          ref,
          { onboardingCompleted: true, updatedAt: serverTimestamp() },
          { merge: true },
        );
      },
      (err) => {
        console.error("PlanPage entitlement listener failed", err);
        setCheckingEntitlement(false);
      },
    );

    return () => unsub();
  }, [authResolved, authUser, router]);

  async function startCheckout(plan: Plan) {
    if (loadingPlan) return;

    if (!authUser) {
      router.push("/auth?next=%2Fonboarding%2Fplan");
      return;
    }

    setLoadingPlan(plan);

    try {
      const token = await authUser.getIdToken();

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
        try {
          await writeOnboarding({
            recommendedPlan: rec.kind,
            runwayMonths: rec.runwayMonths,
            chosenPlan: plan,
          });
        } catch (e) {
          console.error("writeOnboarding(plan) failed", e);
        }

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

  if (!authResolved || checkingEntitlement) {
    return (
      <OnboardingShell
        step={6}
        total={6}
        title="Preparing…"
        subtitle="Loading your plan options."
        backHref="/onboarding/background"
      >
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="h-4 w-40 rounded bg-white/10" />
          <div className="mt-3 h-4 w-full rounded bg-white/10" />
          <div className="mt-6 grid gap-3">
            <div className="h-20 rounded-2xl bg-white/10" />
            <div className="h-20 rounded-2xl bg-white/10" />
          </div>
        </div>
      </OnboardingShell>
    );
  }

  const recommendedPlan: Plan =
    rec.kind === "MONTHLY" ? "MONTHLY" : "ANNUAL";

  const subtitle =
    rec.kind === "MONTHLY"
      ? "We recommend Monthly for your timeline."
      : rec.kind === "ANNUAL"
        ? "We recommend Annual for value across your runway."
        : "Annual is best value for most students — but either works.";

  return (
    <OnboardingShell
      step={6}
      total={6}
      title="Choose your plan"
      subtitle={subtitle}
      backHref="/onboarding/background"
    >
      <div className="grid gap-4">
        {/* Tight recommendation summary */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Recommended</div>
              <div className="mt-1 text-xs text-white/60">
                Based on your onboarding answers
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-semibold text-white">
                {recommendedPlan === "MONTHLY" ? "Monthly" : "Annual"}
              </div>
              <div className="mt-1 text-[11px] text-white/50">
                {recommendedPlan === "MONTHLY"
                  ? `Free trial — ${TRIAL_MONTHLY_DAYS} days`
                  : `Free trial — ${TRIAL_ANNUAL_DAYS} days`}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="chip">£0 today</span>
                        <span className="chip">
              {recommendedPlan === "MONTHLY"
                ? `${formatGBP(PRICE_MONTHLY)} / month`
                : `${formatGBP(PRICE_ANNUAL)} / year`}
            </span>
            <span className="chip">Cancel anytime</span>
          </div>
        </div>

        {/* Options */}
        <div className="grid gap-3">
          <PlanOption
            label="Annual"
            plan="ANNUAL"
            recommended={recommendedPlan === "ANNUAL"}
            trialDays={TRIAL_ANNUAL_DAYS}
            primaryLine={`${formatGBP(PRICE_ANNUAL)} / year`}
            secondaryLine={`≈ ${formatGBP(annualAsMonthly)}/month · Save ~${savingsPct}% vs monthly`}
            finePrint={`After ${TRIAL_ANNUAL_DAYS} days, billed annually unless you cancel before the trial ends.`}
            disabled={loadingPlan !== null}
            onChoose={startCheckout}
          />

          <PlanOption
            label="Monthly"
            plan="MONTHLY"
            recommended={recommendedPlan === "MONTHLY"}
            trialDays={TRIAL_MONTHLY_DAYS}
            primaryLine={`${formatGBP(PRICE_MONTHLY)} / month`}
            secondaryLine="Maximum flexibility · Cancel any time"
            finePrint={`After ${TRIAL_MONTHLY_DAYS} days, billed monthly unless you cancel before the trial ends.`}
            disabled={loadingPlan !== null}
            onChoose={startCheckout}
          />
        </div>

        {/* Micro footer */}
        <div className="text-[11px] leading-relaxed text-white/50">
          You’ll be redirected to Stripe Checkout. If you return and still see this page,
          refresh once — entitlement can take a moment to confirm.{" "}
          <Link href="/legal" className="underline underline-offset-2">
            Terms
          </Link>
          .
        </div>
      </div>
    </OnboardingShell>
  );
}