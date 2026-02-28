import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

export const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

const enableFirebaseDebug =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_FIREBASE_DEBUG === "1";

if (typeof window !== "undefined" && enableFirebaseDebug) {
  // Runtime check for domain/config mismatches, enabled only for local debug.
  console.log("[firebase] origin:", window.location.origin);
  console.log("[firebase] authDomain:", auth.config.authDomain);
  console.log("[firebase] projectId:", auth.app.options.projectId);

  type DebugWindow = Window & {
    __sqezFirebaseDebug?: {
      config: {
        apiKey?: string;
        authDomain?: string;
        projectId?: string;
      };
    };
  };

  (window as DebugWindow).__sqezFirebaseDebug = {
    config: {
      apiKey: auth.app.options.apiKey,
      authDomain: auth.config.authDomain,
      projectId: auth.app.options.projectId,
    },
  };
}
