import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export async function ensureUserBootstrap(params: {
  uid: string;
  email: string | null;
}) {
  const { uid, email } = params;

  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  const data = snap.data() as
    | {
        onboardingCompleted?: unknown;
        onboarding?: unknown;
      }
    | undefined;

  if (!snap.exists()) {
    await setDoc(userRef, {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      email: email ?? "",
      firstName: "",
      lastName: "",
      mfaEnrolled: false,
      onboardingCompleted: false,
      onboarding: {
        hoursPerWeek: 0,
        persona: "",
        targetExamDate: null, // you can switch to array later
      },
      fcmToken: "",
      fcmTokenUpdatedAt: serverTimestamp(),
    });
  } else {
    const patch: Record<string, unknown> = {
      // Keep existing user doc, but ensure updatedAt at least moves forward.
      updatedAt: serverTimestamp(),
      email: email ?? "",
    };

    // Record onboarding-required state for legacy / provider-created docs that missed this.
    if (typeof data?.onboardingCompleted !== "boolean") {
      patch.onboardingCompleted = false;
    }
    if (!data?.onboarding || typeof data.onboarding !== "object") {
      patch.onboarding = {
        hoursPerWeek: 0,
        persona: "",
        targetExamDate: null,
      };
    }

    await setDoc(userRef, patch, { merge: true });
  }
}
