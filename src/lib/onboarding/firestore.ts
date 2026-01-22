"use client";

import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";

type OnboardingPatch = Record<string, unknown>;

export async function writeOnboarding(patch: OnboardingPatch) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  // Merge into users/{uid}.onboarding map
  await setDoc(
    doc(db, "users", user.uid),
    {
      onboarding: patch,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}