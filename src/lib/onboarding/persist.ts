import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { OnboardingAnswers } from "@/lib/onboarding/store";

export async function saveOnboarding(uid: string, answers: OnboardingAnswers) {
  const ref = doc(db, "users", uid, "onboarding", "current");
  await setDoc(
    ref,
    {
      ...answers,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}