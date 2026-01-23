"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase/client";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}


type Status = "idle" | "authing" | "done" | "error";

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function userHasName(uid: string) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return false;
    const data = snap.data() as { firstName?: string; lastName?: string };
    return Boolean(
      typeof data.firstName === "string" &&
        data.firstName.trim() &&
        typeof data.lastName === "string" &&
        data.lastName.trim(),
    );
  } catch {
    return false;
  }
}

async function ensureUserDoc(params: { uid: string; email: string | null }) {
  const { uid, email } = params;

  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  const base = {
    updatedAt: serverTimestamp(),
    email: email ?? "",
  };

  if (!snap.exists()) {
    await setDoc(ref, {
      ...base,
      createdAt: serverTimestamp(),

      // Profile
      firstName: "",
      lastName: "",

      // Notifications
      fcmToken: "",
      fcmTokenUpdatedAt: serverTimestamp(),

      // Security
      mfaEnrolled: false,

      // Onboarding
      onboardingCompleted: false,
      onboarding: {
        hoursPerWeek: 0,
        persona: "",
        targetExamDate: null,
      },

      // Billing / entitlement
      isPro: false,
      subscriptionTier: "free",
      proUpdatedAt: serverTimestamp(),
      lastTransactionID: "",
    });
    return;
  }

  // Merge-only to avoid clobbering existing data
  await setDoc(ref, base, { merge: true });
}

function ProviderButton({
  label,
  onClick,
  variant,
  disabled,
}: {
  label: string;
  onClick: () => void;
  variant: "google" | "apple";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="btn btn-outline w-full justify-center"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      {variant === "google" ? (
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48" className="shrink-0">
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.74 1.22 9.28 3.22l6.94-6.94C35.98 2.04 30.37 0 24 0 14.62 0 6.51 5.38 2.56 13.22l8.08 6.28C12.44 13.12 17.72 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.1 24.55c0-1.64-.15-3.22-.43-4.74H24v9.01h12.4c-.53 2.86-2.14 5.29-4.58 6.93l7.04 5.46c4.12-3.8 6.24-9.39 6.24-16.66z"
          />
          <path
            fill="#FBBC05"
            d="M10.64 28.5c-.52-1.55-.82-3.2-.82-4.9 0-1.7.3-3.35.82-4.9l-8.08-6.28C.93 15.9 0 19.84 0 23.6c0 3.76.93 7.7 2.56 11.18l8.08-6.28z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.37 0 11.98-2.1 15.98-5.7l-7.04-5.46c-1.95 1.31-4.45 2.09-8.94 2.09-6.28 0-11.56-3.62-13.36-8.5l-8.08 6.28C6.51 42.62 14.62 48 24 48z"
          />
        </svg>
      ) : (
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
          <path
            fill="#eaeaea"
            d="M16.365 1.43c0 1.14-.468 2.273-1.293 3.18-.86.95-2.27 1.69-3.49 1.59-.15-1.16.42-2.34 1.22-3.2.86-.96 2.33-1.67 3.56-1.57zM20.64 17.53c-.69 1.59-1.02 2.31-1.91 3.71-1.24 1.95-2.98 4.38-5.13 4.4-1.91.02-2.4-1.25-4.99-1.24-2.59.01-3.14 1.26-5.05 1.24-2.15-.02-3.79-2.2-5.03-4.15C.03 19.39-.95 15.5.62 12.69c1.12-2 2.91-3.18 4.6-3.18 1.84 0 2.99 1.26 5.03 1.26 1.98 0 3.19-1.26 5.04-1.26 1.5 0 3.09.82 4.21 2.23-3.71 2.03-3.11 7.33.74 8.29z"
          />
        </svg>
      )}
      <span>{label}</span>
    </button>
  );
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const canSubmit = useMemo(() => {
    const okEmail = isValidEmail(email);
    const okPw = password.trim().length >= 8;
    return okEmail && okPw && status !== "authing";
  }, [email, password, status]);

  function setIdle() {
    if (status !== "idle") setStatus("idle");
    if (error) setError(null);
  }

  async function onEmailPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      setStatus("error");
      return;
    }

    if (password.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      setStatus("error");
      return;
    }

    setStatus("authing");

    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);

      const user = auth.currentUser;
      if (user) {
        try {
          await ensureUserDoc({ uid: user.uid, email: user.email });
        } catch (e) {
          console.error("ensureUserDoc failed", e);
        }
      }

      const nextDest = next ? safeDecode(next) : "/onboarding";

      // Phase 2: collect names before email verification / onboarding.
      // Verify-email page will auto-send (with throttle) if still unverified.
      const verifyNext = `/verify-email?next=${encodeURIComponent(nextDest)}`;
      router.push(`/name?next=${encodeURIComponent(verifyNext)}`);
      return;
    } catch (err: any) {
      const code = String(err?.code ?? "");
      setStatus("error");

      if (code.includes("auth/email-already-in-use")) {
        setError("An account already exists for that email. Try signing in instead.");
      } else if (code.includes("auth/weak-password")) {
        setError("That password is too weak. Try something longer.");
      } else if (code.includes("auth/invalid-email")) {
        setError("That email address doesn’t look valid.");
      } else {
        setError("Account creation failed. Please try again.");
      }
    }
  }

  async function onProviderSignIn(provider: "google" | "apple") {
    setError(null);
    setStatus("authing");
    try {
      if (provider === "google") {
        const p = new GoogleAuthProvider();
        await signInWithPopup(auth, p);
      } else {
        const p = new OAuthProvider("apple.com");
        await signInWithPopup(auth, p);
      }

      const user = auth.currentUser;
      if (user) {
        try {
          await ensureUserDoc({ uid: user.uid, email: user.email });
        } catch (e) {
          console.error("ensureUserDoc failed", e);
        }
      }

      setStatus("done");

      const nextDest = next ? safeDecode(next) : "/onboarding";

      // Ask for names once if missing (Google/Apple may or may not provide them).
      if (user && !(await userHasName(user.uid))) {
        router.push(`/name?next=${encodeURIComponent(nextDest)}`);
        return;
      }

      router.push(nextDest);
    } catch (err: any) {
      const code = String(err?.code ?? "");
      setStatus("error");

      if (code.includes("auth/popup-closed-by-user")) setError("Sign-up cancelled.");
      else if (code.includes("auth/popup-blocked")) setError("Popup blocked. Allow popups then try again.");
      else if (code.includes("auth/operation-not-allowed"))
        setError("This sign-up method isn’t enabled in Firebase yet.");
      else
        setError(
          provider === "google"
            ? "Google sign-up failed. Please try again."
            : "Apple sign-up failed. Please try again.",
        );
    }
  }

  return (
    <main className="relative min-h-dvh">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0" style={{ backgroundColor: "#0a1a2f" }} />
        <div className="absolute -top-24 left-1/2 h-64 w-[52rem] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-56 left-1/2 h-64 w-[52rem] -translate-x-1/2 rounded-full bg-white/4 blur-3xl" />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a1a2f]/75 backdrop-blur">
        <div className="container-sqez flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-3" aria-label="SQEz home">
            <img src="/sqez-logo.svg" alt="SQEz" className="h-5 w-auto" />
            <span className="sr-only">SQEz</span>
          </Link>

          <Link className="btn btn-ghost px-3 py-2" href="/" aria-label="Back to home">
            Back
          </Link>
        </div>
      </header>

      <div className="container-sqez grid gap-10 px-4 pb-14 pt-10 lg:grid-cols-2">
        {/* Left: copy */}
        <section className="max-w-xl">
          <div className="chip">Create account</div>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            Start building momentum.
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-white/80 sm:text-base">
            Create your SQEz account. Then we’ll personalise your onboarding and get you into your first session.
          </p>

          <div className="mt-6 grid gap-3">
            <div className="card-soft">
              <div className="text-sm font-semibold">Why an account?</div>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-white/80">
                <li>Keep your streak, accuracy, and confidence</li>
                <li>Sync between web and iOS</li>
                <li>Protect your question history and spaced repetition</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Right: form */}
        <section className="w-full">
          <div className="card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Sign up</h2>
                <p className="mt-2 text-sm text-white/75">Choose a method below.</p>
              </div>
              <div className="chip">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Secure
              </div>
            </div>

            <div className="mt-5 grid gap-2">
              <ProviderButton
                variant="google"
                label="Continue with Google"
                onClick={() => onProviderSignIn("google")}
                disabled={status === "authing"}
              />
              <ProviderButton
                variant="apple"
                label="Continue with Apple"
                onClick={() => onProviderSignIn("apple")}
                disabled={status === "authing"}
              />
            </div>

            <div className="my-6 divider" />

            <form onSubmit={onEmailPasswordSubmit}>
              <div className="grid gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/75" htmlFor="email">
                    Email address
                  </label>
                  <input
                    id="email"
                    className="input mt-2"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setIdle();
                    }}
                    aria-invalid={Boolean(error)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/75" htmlFor="password">
                    Password
                  </label>
                  <div className="mt-2 flex items-stretch gap-2">
                    <input
                      id="password"
                      className="input"
                      type={showPw ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setIdle();
                      }}
                      aria-invalid={Boolean(error)}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost px-3 py-2"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? "Hide" : "Show"}
                    </button>
                  </div>
                  <div className="mt-2 text-[11px] text-white/60">Minimum 8 characters.</div>
                </div>

                {error ? (
                  <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs text-red-100">
                    {error}
                  </div>
                ) : null}

                <button type="submit" className="btn btn-primary w-full" disabled={!canSubmit}>
                  {status === "authing" ? "Creating account…" : "Create account"}
                </button>

                <div className="text-xs leading-relaxed text-white/70">
                  By continuing, you agree to our <Link href="/legal/terms">Terms</Link> and{" "}
                  <Link href="/legal/privacy">Privacy Policy</Link>.
                </div>

                <div className="pt-2 text-xs text-white/70">
                  Already have an account?{" "}
                  <Link
                    href={next ? `/auth?next=${encodeURIComponent(next)}` : "/auth"}
                    className="underline"
                  >
                    Sign in
                  </Link>
                </div>
              </div>
            </form>
          </div>

          <p className="mt-4 text-center text-xs text-white/60">
            SQEz is a revision companion tool — not a prep-course replacement.
          </p>
        </section>
      </div>
    </main>
  );
}