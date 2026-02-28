"use client";

import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";

type OnboardingPatch = Record<string, unknown>;

export async function writeOnboarding(patch: OnboardingPatch) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const mergeFields: string[] = ["updatedAt"];
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  for (const [key, value] of Object.entries(patch)) {
    const trimmed = key.trim();
    if (!trimmed) continue;
    payload[`onboarding.${trimmed}`] = value;
    mergeFields.push(`onboarding.${trimmed}`);
  }

  // Merge onboarding subfields into users/{uid}.onboarding map
  await setDoc(
    doc(db, "users", user.uid),
    payload,
    { mergeFields },
  );
}
