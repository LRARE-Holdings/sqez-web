"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingShell, OptionButton } from "@/components/onboarding/OnboardingShell";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import type { LegalBackground, Location } from "@/lib/onboarding/store";

import { writeOnboarding } from "@/lib/onboarding/firestore";
import { UNIVERSITIES_UK } from "@/lib/universities";

function normalizeUni(s: string): string {
  return s.trim().toLowerCase();
}

function canonicalUniversity(input: string): string {
  const needle = normalizeUni(input);
  if (!needle) return "";
  const found = UNIVERSITIES_UK.find((u) => normalizeUni(u) === needle);
  return found ?? "";
}

export default function BackgroundPage() {
  const router = useRouter();
  const { answers, setAnswers } = useOnboarding();

  useEffect(() => {
    // Persist non-empty onboarding answers to Firestore
    const patch: Record<string, unknown> = {};

    if (answers.location) {
      // Map Location enum to Firestore field name
      patch.homeCountry = answers.location;
    }
    if (answers.legalBackground) {
      patch.universityBackground = answers.legalBackground;
    }
    // Only write if there is something to persist
    if (Object.keys(patch).length === 0) return;

    void writeOnboarding(patch).catch((e) => console.error("writeOnboarding failed", e));
  }, [answers.location, answers.legalBackground]);

  const [university, setUniversity] = useState(answers.university ?? "");
  const universityCanonical = useMemo(() => canonicalUniversity(university), [university]);
  const universityValid = useMemo(
    () => university.trim().length === 0 || universityCanonical.length > 0,
    [university, universityCanonical]
  );
  const canContinue = useMemo(
    () => Boolean(answers.location && answers.legalBackground) && universityValid,
    [answers.location, answers.legalBackground, universityValid]
  );

  function pickLocation(location: Location) {
    setAnswers({ location });
  }
  function pickLegal(legalBackground: LegalBackground) {
    setAnswers({ legalBackground });
  }

  async function next(universityInput = university) {
    const uni = canonicalUniversity(universityInput); // empty string if not selected from list
    setAnswers({ university: uni || undefined });

    // Persist university to Firestore (single source of truth)
    try {
      await writeOnboarding({ university: uni });
    } catch (e) {
      console.error("writeOnboarding(university) failed", e);
    }

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
            <OptionButton
              onClick={() => pickLocation("UK")}
              selected={answers.location === "UK"}
            >
              United Kingdom
            </OptionButton>
            <OptionButton
              onClick={() => pickLocation("EU")}
              selected={answers.location === "EU"}
            >
              European Union
            </OptionButton>
            <OptionButton
              onClick={() => pickLocation("INTL")}
              selected={answers.location === "INTL"}
            >
              International
            </OptionButton>
            <OptionButton
              onClick={() => pickLocation("DECLINED")}
              selected={answers.location === "DECLINED"}
            >
              Prefer not to say
            </OptionButton>
          </div>
        </div>

        <div>
          <div className="text-xs text-white/60">Have you previously studied law at university level?</div>
          <div className="mt-3 grid gap-3">
            <OptionButton
              onClick={() => pickLegal("LAW")}
              selected={answers.legalBackground === "LAW"}
            >
              Yes — law degree
            </OptionButton>
            <OptionButton
              onClick={() => pickLegal("NON_LAW")}
              selected={answers.legalBackground === "NON_LAW"}
            >
              Yes — non-law degree
            </OptionButton>
            <OptionButton
              onClick={() => pickLegal("CAREER_CHANGE")}
              selected={answers.legalBackground === "CAREER_CHANGE"}
            >
              No — career changer
            </OptionButton>
            <OptionButton
              onClick={() => pickLegal("DECLINED")}
              selected={answers.legalBackground === "DECLINED"}
            >
              Prefer not to say
            </OptionButton>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs text-white/60">If you’re happy to share, where did you study? (optional)</div>
          <input
            className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/40 focus:border-white/25"
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
            placeholder="Start typing to search (UK universities)"
            list="sqez-university-list"
            autoComplete="off"
            aria-label="University"
          />
          <datalist id="sqez-university-list">
            {UNIVERSITIES_UK.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          {!universityValid ? (
            <div className="mt-2 text-xs text-amber-200/90">
              Please choose a university from the list (or clear this field to skip).
            </div>
          ) : null}
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
                void next("");
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
