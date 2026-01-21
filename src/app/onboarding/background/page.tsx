"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingShell, OptionButton } from "@/components/onboarding/OnboardingShell";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import type { LegalBackground, Location } from "@/lib/onboarding/store";

export default function BackgroundPage() {
  const router = useRouter();
  const { answers, setAnswers } = useOnboarding();

  const [university, setUniversity] = useState(answers.university ?? "");
  const canContinue = useMemo(() => Boolean(answers.location && answers.legalBackground), [answers]);

  function pickLocation(location: Location) {
    setAnswers({ location });
  }
  function pickLegal(legalBackground: LegalBackground) {
    setAnswers({ legalBackground });
  }

  function next() {
    setAnswers({ university: university.trim() || undefined });
    router.push("/onboarding/plan");
  }

  return (
    <OnboardingShell
      step={6}
      total={6}
      title="A bit of context"
      subtitle="This is optional and won’t affect how we treat you — it helps us tailor your experience."
      backHref="/onboarding/funding"
    >
      <div className="grid gap-6">
        <div>
          <div className="text-xs text-white/60">Where are you based right now?</div>
          <div className="mt-3 grid gap-3">
            <OptionButton onClick={() => pickLocation("UK")}>United Kingdom</OptionButton>
            <OptionButton onClick={() => pickLocation("EU")}>European Union</OptionButton>
            <OptionButton onClick={() => pickLocation("INTL")}>International</OptionButton>
            <OptionButton onClick={() => pickLocation("DECLINED")}>Prefer not to say</OptionButton>
          </div>
        </div>

        <div>
          <div className="text-xs text-white/60">Have you previously studied law at university level?</div>
          <div className="mt-3 grid gap-3">
            <OptionButton onClick={() => pickLegal("LAW")}>Yes — law degree</OptionButton>
            <OptionButton onClick={() => pickLegal("NON_LAW")}>Yes — non-law degree</OptionButton>
            <OptionButton onClick={() => pickLegal("CAREER_CHANGE")}>No — career changer</OptionButton>
            <OptionButton onClick={() => pickLegal("DECLINED")}>Prefer not to say</OptionButton>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs text-white/60">If you’re happy to share, where did you study? (optional)</div>
          <input
            className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/40 focus:border-white/25"
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
            placeholder="e.g. University of Bristol"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn btn-primary flex-1"
              onClick={next}
              disabled={!canContinue}
            >
              Continue
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setUniversity("");
                next();
              }}
              disabled={!canContinue}
            >
              Skip
            </button>
          </div>
          {!canContinue ? (
            <div className="mt-2 text-xs text-white/60">
              Please pick your location and background to continue.
            </div>
          ) : null}
        </div>
      </div>
    </OnboardingShell>
  );
}