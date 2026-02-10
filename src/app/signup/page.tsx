"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  signInWithPopup,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";
import { sanitizeNextPath } from "@/lib/navigation";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type Status = "idle" | "loading";

async function userHasName(uid: string) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return false;

    const data = snap.data() as { firstName?: string; lastName?: string };
    const first = typeof data.firstName === "string" ? data.firstName.trim() : "";
    const last = typeof data.lastName === "string" ? data.lastName.trim() : "";
    return Boolean(first && last);
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

      // Onboarding
      onboardingCompleted: false,
      onboarding: {
        hoursPerWeek: 0,
        persona: "",
        targetExamDate: null,
      },
    });
    return;
  }

  // Merge-only to avoid clobbering existing data
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
      <span>{label}</span>
    </button>
  );
}

function passwordLooksOk(pw: string) {
  // keep it simple + user-friendly (no harsh rejections beyond min length)
  const s = pw.trim();
  return s.length >= 8;
}

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = sanitizeNextPath(searchParams.get("next"), "/onboarding");
  const signinHref = `/auth?next=${encodeURIComponent(nextPath)}`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return (
      status !== "loading" &&
      isValidEmail(email) &&
      passwordLooksOk(password)
    );
  }, [email, password, status]);

  function clearError() {
    if (error) setError(null);
  }

  async function routeAfterSignup(params: { user: User; isPasswordUser: boolean }) {
    const { user, isPasswordUser } = params;

    try {
      await ensureUserDoc({ uid: user.uid, email: user.email });
    } catch (e) {
      // If your rules block initial writes, this is where you'll see it.
      console.error("ensureUserDoc failed", e);
    }

    // We always want name captured at least once.
    const hasName = await userHasName(user.uid);

    if (isPasswordUser) {
      // Password users: Name -> Verify Email -> nextPath
      const verifyNext = `/verify-email?next=${encodeURIComponent(nextPath)}`;
      router.push(`/name?next=${encodeURIComponent(verifyNext)}`);
      return;
    }

    // Provider users: If missing name, ask; otherwise straight to nextPath
    if (!hasName) {
      router.push(`/name?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    router.push(nextPath);
  }

  async function onEmailPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();

    const trimmedEmail = email.trim();

    if (!isValidEmail(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!passwordLooksOk(password)) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setStatus("loading");
    try {
      const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      await routeAfterSignup({ user: cred.user, isPasswordUser: true });
    } catch (err: any) {
      const code = String(err?.code ?? "");
      if (code.includes("auth/email-already-in-use")) {
        setError("An account already exists for that email. Try signing in instead.");
      } else if (code.includes("auth/weak-password")) {
        setError("That password is too weak. Try something longer.");
      } else if (code.includes("auth/invalid-email")) {
        setError("That email address doesn’t look valid.");
      } else if (code.includes("auth/too-many-requests")) {
        setError("Too many attempts. Try again later.");
      } else {
        setError("Account creation failed. Please try again.");
      }
    } finally {
      setStatus("idle");
    }
  }

  async function onProviderSignUp(provider: "google" | "apple") {
    clearError();
    setStatus("loading");

    try {
      if (provider === "google") {
        await signInWithPopup(auth, new GoogleAuthProvider());
      } else {
        await signInWithPopup(auth, new OAuthProvider("apple.com"));
      }

      const user = auth.currentUser;
      if (!user) {
        setError("Sign-up failed. Please try again.");
        return;
      }

      await routeAfterSignup({ user, isPasswordUser: false });
    } catch (err: any) {
      const code = String(err?.code ?? "");
      if (code.includes("auth/popup-closed-by-user")) {
        setError("Sign-up cancelled.");
      } else if (code.includes("auth/popup-blocked")) {
        setError("Popup blocked. Allow popups then try again.");
      } else if (code.includes("auth/operation-not-allowed")) {
        setError("This sign-up method isn’t enabled in Firebase yet.");
      } else if (code.includes("auth/account-exists-with-different-credential")) {
        setError("That email already exists with a different sign-in method.");
      } else {
        setError(
          provider === "google"
            ? "Google sign-up failed. Please try again."
            : "Apple sign-up failed. Please try again.",
        );
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
        <div className="absolute -top-24 left-1/2 h-64 w-[52rem] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-56 left-1/2 h-64 w-[52rem] -translate-x-1/2 rounded-full bg-white/4 blur-3xl" />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a1a2f]/75 backdrop-blur">
        <div className="container-sqez flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-3 !no-underline" aria-label="SQEz home">
            <img src="/sqez-logo.svg" alt="SQEz" className="h-5 w-auto" />
            <span className="sr-only">SQEz</span>
          </Link>

          <Link className="btn btn-ghost px-3 py-2 !no-underline" href="/" aria-label="Back to home">
            Back
          </Link>
        </div>
      </header>

      <div className="container-sqez px-4 pb-14 pt-10">
        <div className="mx-auto grid w-full max-w-[980px] gap-8 lg:grid-cols-2">
          {/* Left */}
          <section className="hidden lg:block">
            <div className="chip">Create account</div>

            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white">
              Your journey begins here.
            </h1>

            <p className="mt-4 text-sm leading-relaxed text-white/80">
              Create your SQEz account, tell us a bit about you and we'll take it from there.
            </p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
              <div className="text-sm font-semibold text-white">Already got an account?</div>
              <div className="mt-1 text-sm text-white/80">
                Sign in and pick up exactly where you left off.
              </div>
              <div className="mt-4">
                <Link href={signinHref} className="btn btn-primary w-full sm:w-auto !no-underline">
                  Sign in
                </Link>
              </div>
            </div>
          </section>

          {/* Right */}
          <section className="w-full">
            <div className="card">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-white">Sign up</h2>
                <p className="mt-2 text-sm text-white/75">
                  Use Google/Apple or email + password.
                </p>
              </div>

              <div className="mt-5 grid gap-2">
                <ProviderButton
                  label="Continue with Google"
                  onClick={() => onProviderSignUp("google")}
                  disabled={status === "loading"}
                />
                <ProviderButton
                  label="Continue with Apple"
                  onClick={() => onProviderSignUp("apple")}
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
                      clearError();
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
                        clearError();
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

                  <div className="mt-2 text-[11px] text-white/60">
                    Minimum 8 characters.
                  </div>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-rose-200/20 bg-rose-200/10 px-4 py-3 text-sm text-rose-100">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={!canSubmit}
                >
                  {status === "loading" ? "Creating account…" : "Create account"}
                </button>

                <div className="text-xs leading-relaxed text-white/70">
                  By continuing, you agree to our{" "}
                  <Link href="https://lrare.co.uk/terms" className="!no-underline hover:underline">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="https://lrare.co.uk/privacy" className="!no-underline hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </div>

                <div className="pt-2 text-xs text-white/70">
                  Already have an account?{" "}
                  <Link href={signinHref} className="font-medium text-white !no-underline hover:underline">
                    Sign in
                  </Link>
                </div>
              </form>
            </div>

          </section>
        </div>
      </div>
    </main>
  );
}
