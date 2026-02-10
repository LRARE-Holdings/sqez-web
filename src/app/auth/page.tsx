"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GoogleAuthProvider,
  OAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";
import { sanitizeNextPath } from "@/lib/navigation";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

type Status = "idle" | "loading";

function logAuthError(context: string, err: any) {
  // Avoid throwing noisy console errors for expected auth flows.
  // NOTE: Some dev setups treat console.error as a hard error.
  console.groupCollapsed(`🔥 AUTH DEBUG [${context}]`);
  console.log("code:", err?.code);
  console.log("message:", err?.message);
  console.log("customData:", err?.customData);
  console.log("full error:", err);
  console.trace();
  console.groupEnd();
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

      // Billing / entitlement is server-owned (e.g. Stripe/webhooks). Do not set client-side.
    });
    return;
  }

  await setDoc(ref, base, { merge: true });
}

function ProviderButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="btn btn-outline w-full justify-center text-white"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      {label}
    </button>
  );
}

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = sanitizeNextPath(searchParams.get("next"), "/app");
  const signupHref = `/signup?next=${encodeURIComponent(nextPath)}`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return (
      status !== "loading" &&
      isValidEmail(email) &&
      String(password ?? "").trim().length >= 8
    );
  }, [email, password, status]);

  function clearMessages() {
    if (error) setError(null);
    if (info) setInfo(null);
  }


  async function routeAfterAuth(provider: "password" | "provider") {
    const user = auth.currentUser;
    if (!user) {
      router.replace(`/auth?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    // Firestore doc creation/merge should never block auth UX.
    try {
      await ensureUserDoc({ uid: user.uid, email: user.email });
    } catch (e) {
      console.error("⚠️ AUTH OK, FIRESTORE FAILED (ensureUserDoc)", e);
    }

    router.push(nextPath);
  }

  async function onEmailPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();

    const safeEmail = String(email ?? "").trim();
    const safePw = String(password ?? "");

    if (!isValidEmail(safeEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (safePw.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setStatus("loading");
    try {
      await signInWithEmailAndPassword(auth, safeEmail, safePw);
      await routeAfterAuth("password");
    } catch (err: any) {
      const code = String(err?.code ?? "");

      // MFA is no longer supported on web for SQEz.
      if (code === "auth/multi-factor-auth-required") {
        setError(
          "This account has multi-factor authentication enabled, which SQEz web no longer supports. Please contact support to disable MFA on your account."
        );
        return;
      }

      // Everything else is unexpected — log for diagnosis.
      logAuthError("email-password", err);

      if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password")) {
        setError("Incorrect email or password.");
      } else if (code.includes("auth/user-not-found")) {
        setError("No account found for that email.");
      } else if (code.includes("auth/user-disabled")) {
        setError("This account has been disabled.");
      } else if (code.includes("auth/too-many-requests")) {
        setError("Too many attempts. Try again later.");
      } else if (code.includes("auth/network-request-failed")) {
        setError("Network error. Check your connection.");
      } else if (code.includes("auth/invalid-email")) {
        setError("That email address doesn’t look valid.");
      } else {
        setError(`Sign-in failed (${code || "unknown"}).`);
      }
    } finally {
      setStatus("idle");
    }
  }

  async function onProviderSignIn(provider: "google" | "apple") {
    clearMessages();
    setStatus("loading");

    try {
      if (provider === "google") {
        await signInWithPopup(auth, new GoogleAuthProvider());
      } else {
        await signInWithPopup(auth, new OAuthProvider("apple.com"));
      }
      await routeAfterAuth("provider");
    } catch (err: any) {
      logAuthError(`provider-${provider}`, err);

      const code = String(err?.code ?? "");
      if (code.includes("auth/popup-closed-by-user")) {
        setError("Sign-in cancelled.");
      } else if (code.includes("auth/popup-blocked")) {
        setError("Popup blocked. Allow popups then try again.");
      } else if (code.includes("auth/account-exists-with-different-credential")) {
        setError("An account already exists with this email. Try signing in with email instead.");
      } else if (code.includes("auth/operation-not-allowed")) {
        setError("This sign-in method isn’t enabled in Firebase yet.");
      } else if (code.includes("auth/network-request-failed")) {
        setError("Network error. Check your connection.");
      } else {
        setError(`Provider sign-in failed (${code || "unknown"}).`);
      }
    } finally {
      setStatus("idle");
    }
  }

  async function onResetPassword() {
    clearMessages();

    const safeEmail = String(email ?? "").trim();
    if (!isValidEmail(safeEmail)) {
      setError("Enter your email above, then press reset.");
      return;
    }

    setStatus("loading");
    try {
      await sendPasswordResetEmail(auth, safeEmail);
      setInfo("Password reset email sent. Check your inbox (and spam).");
    } catch (err: any) {
      logAuthError("password-reset", err);
      const code = String(err?.code ?? "");
      if (code.includes("auth/user-not-found")) {
        setError("No account found for that email.");
      } else if (code.includes("auth/too-many-requests")) {
        setError("Too many requests. Try again later.");
      } else {
        setError("Couldn’t send reset email. Please try again.");
      }
    } finally {
      setStatus("idle");
    }
  }

  return (
    <main className="relative min-h-dvh">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0" style={{ backgroundColor: "#0a1a2f" }} />
        <div className="absolute -top-24 left-1/2 h-64 w-208 -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-56 left-1/2 h-64 w-208 -translate-x-1/2 rounded-full bg-white/4 blur-3xl" />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a1a2f]/75 backdrop-blur">
        <div className="container-sqez flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-3 no-underline!" aria-label="SQEz home">
            <img src="/sqez-logo.svg" alt="SQEz" className="h-5 w-auto" />
            <span className="sr-only">SQEz</span>
          </Link>

          <Link className="btn btn-ghost px-3 py-2 no-underline!" href="/" aria-label="Back to home">
            Back
          </Link>
        </div>
      </header>

      <div className="container-sqez px-4 pb-14 pt-10">
        <div className="mx-auto grid w-full max-w-245 gap-8 lg:grid-cols-2">
          {/* Left */}
          <section className="hidden lg:block">
            <div className="chip">Sign in</div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white">
              Pick up where you left off.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-white/80">
              Your progress, stats, flags, and feedback sync across iOS and web.
            </p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
              <div className="text-sm font-semibold text-white">New to SQEz?</div>
              <div className="mt-1 text-sm text-white/80">
                Create an account to start onboarding and get your recommended plan.
              </div>
              <div className="mt-4">
                <Link href={signupHref} className="btn btn-primary w-full sm:w-auto no-underline!">
                  Create account
                </Link>
              </div>
            </div>
          </section>

          {/* Right */}
          <section className="w-full">
            <div className="card">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-white">Sign in</h2>
              </div>

              <div className="mt-5 grid gap-2">
                <ProviderButton
                  label="Continue with Google"
                  onClick={() => void onProviderSignIn("google")}
                  disabled={status === "loading"}
                />
                <ProviderButton
                  label="Continue with Apple"
                  onClick={() => void onProviderSignIn("apple")}
                  disabled={status === "loading"}
                />
              </div>

              <div className="my-6 divider" />

              <form onSubmit={onEmailPasswordSubmit} className="grid gap-4">
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
                      clearMessages();
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
                      autoComplete="current-password"
                      placeholder="Your password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearMessages();
                      }}
                      aria-invalid={Boolean(error)}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost px-3 py-2"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      disabled={status === "loading"}
                    >
                      {showPw ? "Hide" : "Show"}
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-white/60">
                    <span></span>
                    <button
                      type="button"
                      className="btn btn-ghost px-3 py-2"
                      onClick={() => void onResetPassword()}
                      disabled={status === "loading"}
                    >
                      Reset password
                    </button>
                  </div>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-rose-200/20 bg-rose-200/10 px-4 py-3 text-sm text-rose-100">
                    {error}
                  </div>
                ) : null}

                {info ? (
                  <div className="rounded-2xl border border-emerald-200/20 bg-emerald-200/10 px-4 py-3 text-sm text-emerald-50">
                    {info}
                  </div>
                ) : null}

                <button type="submit" className="btn btn-primary w-full" disabled={!canSubmit}>
                  {status === "loading" ? "Signing in…" : "Sign in"}
                </button>

                <div className="text-xs leading-relaxed text-white/70">
                  By continuing, you agree to our{" "}
                  <Link href="/legal/terms" className="no-underline! hover:underline">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="/legal/privacy" className="no-underline! hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </div>

                <div className="pt-2 text-xs text-white/70">
                  Don&apos;t have an account?{" "}
                  <Link href={signupHref} className="font-medium text-white no-underline! hover:underline">
                    Create one
                  </Link>
                </div>
              </form>
            </div>

            <p className="mt-4 text-center text-xs text-white/60">
              SQEz is a revision companion tool — not a prep-course replacement.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
