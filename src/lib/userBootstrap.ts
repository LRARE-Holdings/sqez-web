import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export async function ensureUserBootstrap(params: {
  uid: string;
  email: string | null;
}) {
  const { uid, email } = params;

  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);

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
      isPro: false,
      subscriptionTier: "free",
      proUpdatedAt: serverTimestamp(),
      lastTransactionID: "",
      fcmToken: "",
      fcmTokenUpdatedAt: serverTimestamp(),
    });
  } else {
    // Keep existing user doc, but ensure updatedAt at least moves forward.
    await setDoc(
      userRef,
      { updatedAt: serverTimestamp(), email: email ?? "" },
      { merge: true },
    );
  }
}