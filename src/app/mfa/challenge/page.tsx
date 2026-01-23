"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  getMultiFactorResolver,
  signInWithEmailAndPassword,
  type MultiFactorInfo,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";

type Step = "boot" | "sending" | "code";
type Status = "idle" | "loading";

function logAuthError(context: string, err: any) {
  console.group(`🔥 MFA ERROR [${context}]`);
  console.error("code:", err?.code);
  console.error("message:", err?.message);
  console.error("full error:", err);
  console.trace();
  console.groupEnd();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
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

      firstName: "",
      lastName: "",

      fcmToken: "",
      fcmTokenUpdatedAt: serverTimestamp(),

      mfaEnrolled: false,

      onboardingCompleted: false,
      onboarding: {
        hoursPerWeek: 0,
        persona: "",
        targetExamDate: null,
      },

      isPro: false,
      subscriptionTier: "free",
      proUpdatedAt: serverTimestamp(),
      lastTransactionID: "",
    });
    return;
  }

  await setDoc(ref, base, { merge: true });
}

function phoneHintLabel(hint: MultiFactorInfo | undefined | null) {
  if (!hint) return "your phone";
  const anyHint = hint as unknown as { phoneNumber?: string };
  return anyHint.phoneNumber ? String(anyHint.phoneNumber) : "your phone";
}

export default function MfaChallengePage() {
  const router = useRouter();
  const sp = useSearchParams();
  const nextParam = sp.get("next");
  const nextPath = nextParam ? decodeURIComponent(nextParam) : "/app";

  const [status, setStatus] = useState<Status>("idle");
  const [step, setStep] = useState<Step>("boot");

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");

  const [hintLabel, setHintLabel] = useState<string>("your phone");
  const [verificationId, setVerificationId] = useState<string>("");
  const [resolver, setResolver] = useState<any>(null);

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recaptchaRef = useMemo(
    () => ({ verifier: null as RecaptchaVerifier | null }),
    [],
  );

  function clearBridge() {
    try {
      sessionStorage.removeItem("sqez_mfa_email");
      sessionStorage.removeItem("sqez_mfa_pw");
      sessionStorage.removeItem("sqez_mfa_next");
    } catch {
      // ignore
    }
  }

  function ensureRecaptcha() {
    if (recaptchaRef.verifier) return recaptchaRef.verifier;
    const v = new RecaptchaVerifier(auth, "mfa-recaptcha", { size: "invisible" });
    recaptchaRef.verifier = v;
    return v;
  }

  async function bootstrapAndSendCode(creds: { email: string; pw: string }) {
    setError(null);
    setStatus("loading");

    const e = String(creds.email ?? "").trim();
    const p = String(creds.pw ?? "");

    if (!isValidEmail(e) || !p) {
      setError("MFA session expired. Please sign in again.");
      setStep("boot");
      setStatus("idle");
      return;
    }

    try {
      // Re-run sign-in to reproduce the MFA-required error and get the resolver.
      await signInWithEmailAndPassword(auth, e, p);

      // If we get here, MFA wasn’t required (or user already signed in).
      clearBridge();
      router.replace(nextPath);
      return;
    } catch (err: any) {
      const c = String(err?.code ?? "");
      if (!c.includes("auth/multi-factor-auth-required")) {
        logAuthError("bootstrap-signin", err);
        setError(
          c.includes("auth/invalid-credential") || c.includes("auth/wrong-password")
            ? "Incorrect email or password."
            : `Sign-in failed (${c || "unknown"}).`,
        );
        setStatus("idle");
        return;
      }

      // Build resolver and send SMS
      try {
        const r = getMultiFactorResolver(auth, err);
        setResolver(r);

        const hint = (r.hints?.[0] as MultiFactorInfo | undefined) ?? undefined;
        setHintLabel(phoneHintLabel(hint));

        setStep("sending");

        const verifier = ensureRecaptcha();
        const provider = new PhoneAuthProvider(auth);

        const vid = await provider.verifyPhoneNumber(
          { multiFactorHint: hint, session: r.session },
          verifier,
        );

        setVerificationId(vid);
        setStep("code");
        setStatus("idle");
      } catch (e: any) {
        logAuthError("send-code", e);
        setError(
          String(e?.code ?? "").includes("auth/network-request-failed")
            ? "Network error while sending the verification code."
            : "Couldn’t send the verification code. Try again.",
        );
        setStep("boot");
        setStatus("idle");
      }
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const c = code.trim();
    if (c.length < 4) {
      setError("Enter the code from your SMS.");
      return;
    }
    if (!resolver || !verificationId) {
      setError("MFA session missing. Please sign in again.");
      return;
    }

    setStatus("loading");
    try {
      const cred = PhoneAuthProvider.credential(verificationId, c);
      const assertion = PhoneMultiFactorGenerator.assertion(cred);

      await resolver.resolveSignIn(assertion);

      // Now signed in ✅
      clearBridge();

      const user = auth.currentUser;
      if (user) {
        try {
          await ensureUserDoc({ uid: user.uid, email: user.email });
        } catch (e) {
          console.error("⚠️ MFA OK, FIRESTORE FAILED (ensureUserDoc)", e);
        }
      }

      router.replace(nextPath);
    } catch (err: any) {
      logAuthError("verify-code", err);
      const c2 = String(err?.code ?? "");
      if (c2.includes("auth/invalid-verification-code")) setError("That code isn’t correct. Try again.");
      else if (c2.includes("auth/code-expired")) setError("That code has expired. Send a new one.");
      else if (c2.includes("auth/network-request-failed")) setError("Network error. Check your connection.");
      else setError(`Couldn’t verify code (${c2 || "unknown"}).`);
    } finally {
      setStatus("idle");
    }
  }

  useEffect(() => {
    // Load bridge values
    let e = "";
    let p = "";
    let n = nextPath;

    try {
      e = sessionStorage.getItem("sqez_mfa_email") ?? "";
      p = sessionStorage.getItem("sqez_mfa_pw") ?? "";
      const storedNext = sessionStorage.getItem("sqez_mfa_next");
      if (storedNext) n = storedNext;
    } catch {
      // ignore
    }

    setEmail(e);
    setPw(p);

    if (!isValidEmail(e) || !p) {
      setError("MFA session expired. Please sign in again.");
      setStep("boot");
      return;
    }

    // Send code immediately using the bridge values directly.
    void bootstrapAndSendCode({ email: e, pw: p });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="relative min-h-dvh">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0" style={{ backgroundColor: "#0a1a2f" }} />
        <div className="absolute -top-24 left-1/2 h-64 w-[52rem] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-56 left-1/2 h-64 w-[52rem] -translate-x-1/2 rounded-full bg-white/4 blur-3xl" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a1a2f]/75 backdrop-blur">
        <div className="container-sqez flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-3 !no-underline" aria-label="SQEz home">
            <img src="/sqez-logo.svg" alt="SQEz" className="h-5 w-auto" />
            <span className="sr-only">SQEz</span>
          </Link>
          <Link className="btn btn-ghost px-3 py-2 !no-underline" href="/auth" aria-label="Back to sign in">
            Back
          </Link>
        </div>
      </header>

      <div className="container-sqez px-4 pb-14 pt-10">
        <div className="mx-auto w-full max-w-[520px]">
          <div className="card">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white">Two-step verification</h1>
              <p className="mt-2 text-sm text-white/75">
                {step === "sending" || step === "code"
                  ? <>We’ve sent a code to <span className="text-white/90">{hintLabel}</span>.</>
                  : "Complete verification to continue."}
              </p>
            </div>

            {/* Invisible reCAPTCHA anchor */}
            <div id="mfa-recaptcha" className="hidden" />

            {step === "sending" ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/70">
                Sending code…
              </div>
            ) : null}

            {step === "code" ? (
              <form onSubmit={onVerify} className="mt-6 grid gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/75" htmlFor="mfaCode">
                    Verification code
                  </label>
                  <input
                    id="mfaCode"
                    className="input mt-2"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>

                {error ? (
                  <div className="rounded-2xl border border-rose-200/20 bg-rose-200/10 px-4 py-3 text-sm text-rose-100">
                    {error}
                  </div>
                ) : null}

                <button type="submit" className="btn btn-primary w-full" disabled={status === "loading"}>
                  {status === "loading" ? "Verifying…" : "Verify & continue"}
                </button>

                <button
                  type="button"
                  className="btn btn-outline w-full"
                  disabled={status === "loading"}
                  onClick={() => {
                    clearBridge();
                    router.replace(`/auth?next=${encodeURIComponent(nextPath)}`);
                  }}
                >
                  Cancel
                </button>
              </form>
            ) : null}

            {step === "boot" ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/70">
                {error ?? "Preparing verification…"}
              </div>
            ) : null}
          </div>

          <p className="mt-4 text-center text-xs text-white/60">
            SQEz is a revision companion tool — not a prep-course replacement.
          </p>
        </div>
      </div>
    </main>
  );
}