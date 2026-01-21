"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const ONBOARDING_KEY = "sqez_onboarding_v1";
const COMPLETE_KEY = "sqez_onboarding_complete";

export default function OnboardingGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Never gate the onboarding routes themselves
    if (pathname.startsWith("/onboarding")) return;

    // Never gate auth pages
    if (pathname.startsWith("/login") || pathname.startsWith("/auth")) return;

    // Read onboarding state
    let hasAnswers = false;
    let isComplete = false;

    try {
      hasAnswers = Boolean(localStorage.getItem(ONBOARDING_KEY));
      isComplete = localStorage.getItem(COMPLETE_KEY) === "true";
    } catch {
      // ignore
    }

    // If onboarding not completed, redirect
    if (!isComplete) {
      router.replace("/onboarding");
    }
  }, [pathname, router]);

  return <>{children}</>;
}