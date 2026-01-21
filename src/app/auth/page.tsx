"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

function isValidEmail(value: string) {
  // deliberately simple + practical (avoids false negatives)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type Status = "idle" | "authing" | "done" | "error";

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
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 48 48"
          className="shrink-0"
        >
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
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          className="shrink-0"
        >
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

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

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

    // Placeholder auth flow.
    // Wire later to Firebase Auth signInWithEmailAndPassword.
    setStatus("authing");

    try {
      await new Promise((r) => setTimeout(r, 700));
      setStatus("done");
    } catch {
      setStatus("error");
      setError("Sign-in failed. Please try again.");
    }
  }

  async function onProviderSignIn(provider: "google" | "apple") {
    setError(null);
    setStatus("authing");

    // Placeholder provider flow.
    // Wire later to Firebase Auth (Google / Apple).
    try {
      await new Promise((r) => setTimeout(r, 700));
      setStatus("done");
    } catch {
      setStatus("error");
      setError(
        provider === "google"
          ? "Google sign-in failed. Please try again."
          : "Apple sign-in failed. Please try again.",
      );
    }
  }

  return (
    <main className="relative min-h-dvh">
      {/* Background */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
      >
        <div
          className="absolute inset-0"
          style={{ backgroundColor: "#0a1a2f" }}
        />
        <div className="absolute -top-24 left-1/2 h-64 w-[52rem] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-56 left-1/2 h-64 w-[52rem] -translate-x-1/2 rounded-full bg-white/4 blur-3xl" />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a1a2f]/75 backdrop-blur">
        <div className="container-sqez flex items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="SQEz home"
          >
            <img
              src="/sqez-logo.svg"
              alt="SQEz"
              className="h-5 w-auto"
            />
            <span className="sr-only">SQEz</span>
          </Link>

          <Link
            className="btn btn-ghost px-3 py-2"
            href="/"
            aria-label="Back to home"
          >
            Back
          </Link>
        </div>
      </header>

      <div className="container-sqez grid gap-10 px-4 pb-14 pt-10 lg:grid-cols-2">
        {/* Left: copy */}
        <section className="max-w-xl">
          <div className="chip">Sign in</div>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            Keep your sessions consistent.
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-white/80 sm:text-base">
            Use email + password, or sign in with Apple or Google. No other
            sign-in methods are supported.
          </p>

          <div className="mt-6 grid gap-3">
            <div className="card-soft">
              <div className="text-sm font-semibold">Why sign in?</div>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-white/80">
                <li>Sync your streak, accuracy, and confidence across devices</li>
                <li>Keep your weak areas and spaced repetition intact</li>
                <li>Pick up instantly on web or iOS</li>
              </ul>
            </div>

            <div className="card-soft">
              <div className="text-sm font-semibold">Privacy-first by design</div>
              <p className="mt-2 text-sm leading-relaxed text-white/80">
                We minimise what we collect. Your performance data is for your
                learning — not marketing noise.
              </p>
            </div>
          </div>
        </section>

        {/* Right: form */}
        <section className="w-full">
          <div className="card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Sign in</h2>
                <p className="mt-2 text-sm text-white/75">
                  Choose a method below.
                </p>
              </div>

              <div className="chip">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Secure
              </div>
            </div>

            {/* Provider buttons */}
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

            {/* Email/password */}
            <form onSubmit={onEmailPasswordSubmit}>
              <div className="grid gap-3">
                <div>
                  <label
                    className="block text-xs font-medium text-white/75"
                    htmlFor="email"
                  >
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
                  <label
                    className="block text-xs font-medium text-white/75"
                    htmlFor="password"
                  >
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
                  <div className="mt-2 text-[11px] text-white/60">
                    Minimum 8 characters.
                  </div>
                </div>

                {error ? (
                  <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs text-red-100">
                    {error}
                  </div>
                ) : null}

                {status === "done" ? (
                  <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
                    <div className="text-sm font-semibold">Signed in (mock)</div>
                    <div className="mt-1 text-sm text-white/80">
                      Auth is currently stubbed. Next step: wire Firebase Auth
                      and redirect into your dashboard.
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <Link className="btn btn-primary w-full sm:w-auto" href="/app">
                        Continue to dashboard
                      </Link>
                      <button
                        type="button"
                        className="btn btn-outline w-full sm:w-auto"
                        onClick={() => setStatus("idle")}
                      >
                        Sign out (mock)
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="submit"
                    className="btn btn-primary w-full"
                    disabled={!canSubmit}
                  >
                    {status === "authing" ? "Signing in…" : "Sign in with email"}
                  </button>
                )}

                <div className="text-xs leading-relaxed text-white/70">
                  By continuing, you agree to our{" "}
                  <Link href="/legal/terms">Terms</Link> and{" "}
                  <Link href="/legal/privacy">Privacy Policy</Link>.
                </div>

                <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-white/70">
                    Forgot your password?
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost px-3 py-2"
                    onClick={() => {
                      setError(
                        "Password reset isn’t wired yet. Next: Firebase reset flow.",
                      );
                      setStatus("error");
                    }}
                    disabled={status === "authing"}
                  >
                    Reset password
                  </button>
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