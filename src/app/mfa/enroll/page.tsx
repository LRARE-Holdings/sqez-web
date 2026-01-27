"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  multiFactor,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";
import { needsMfaEnrollment } from "@/lib/auth/mfa";

type Step = "phone" | "code";

function friendlyAuthError(e: any) {
  const code = String(e?.code || "");
  if (code === "auth/invalid-app-credential") {
    return [
      "We couldn’t start SMS verification.",
    ].join("\n");
  }
  if (code === "auth/requires-recent-login") {
    return "For security, please sign in again to add a phone number.";
  }
  if (code === "auth/too-many-requests") {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (code === "auth/invalid-phone-number") {
    return "That phone number doesn’t look valid. Try again.";
  }
  if (code === "auth/code-expired") {
    return "That code expired. Please request a new one.";
  }
  if (code === "auth/invalid-verification-code") {
    return "That code didn’t match. Please try again.";
  }
  return e?.message || "Something went wrong. Please try again.";
}

function normalizePhone(input: string) {
  const raw = input.trim().replace(/[\s()-]/g, "");
  if (!raw) return "";

  if (raw.startsWith("+")) return raw;
  if (raw.startsWith("00")) return `+${raw.slice(2)}`;

  // UK-first behaviour (SQEz is UK-first). Still supports other formats if user types them.
  if (raw.startsWith("44")) return `+${raw}`;
  if (raw.startsWith("0")) return `+44${raw.slice(1)}`;
  if (raw.startsWith("7")) return `+44${raw}`;

  // fallback: assume country code digits were provided without +
  return `+${raw}`;
}

export default function MfaEnrollPage() {
  const router = useRouter();
  const params = useSearchParams();

  const next = params.get("next") || "/onboarding";

  const nextDecoded = useMemo(() => {
    try {
      return decodeURIComponent(next);
    } catch {
      return next;
    }
  }, [next]);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [verificationId, setVerificationId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [needsReauth, setNeedsReauth] = useState(false);

  // We force a *fresh DOM node* for reCAPTCHA on each send attempt to avoid
  // “already been rendered” issues in React/Turbopack/Strict Mode.
  const [captchaKey, setCaptchaKey] = useState(0);

  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  // Clean up verifier on unmount
  useEffect(() => {
    return () => {
      try {
        verifierRef.current?.clear();
      } catch {
        // ignore
      }
      verifierRef.current = null;
    };
  }, []);

  // Lightweight gate:
  // - if not signed in -> auth
  // - if already enrolled -> bounce to next
  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      router.replace(
        `/auth?next=${encodeURIComponent(
          `/mfa/enroll?next=${encodeURIComponent(nextDecoded)}`,
        )}`,
      );
      return;
    }

    if (!needsMfaEnrollment(user)) {
      router.replace(nextDecoded);
      return;
    }
  }, [router, nextDecoded]);

  async function sendCode() {
    setError("");
    setNeedsReauth(false);

    const user = auth.currentUser;
    if (!user) {
      router.replace(`/auth?next=${encodeURIComponent(`/mfa/enroll?next=${encodeURIComponent(nextDecoded)}`)}`);
      return;
    }

    const normalized = normalizePhone(phone);
    if (!normalized.startsWith("+") || normalized.length < 8) {
      setError("Enter a valid mobile number (e.g. 07… or +44…).");
      return;
    }

    setBusy(true);

    // Important: force a new container node before creating verifier
    setCaptchaKey((k) => k + 1);

    // Wait a tick for React to commit the new node
    await new Promise((r) => setTimeout(r, 0));

    try {
      // Clear any existing verifier instance
      try {
        verifierRef.current?.clear();
      } catch {
        // ignore
      }
      verifierRef.current = null;

      const el = document.getElementById("recaptcha-container");
      if (!el) {
        setError("Couldn’t initialise verification. Please refresh and try again.");
        setBusy(false);
        return;
      }

      // On-demand verifier. Do NOT call render() manually.
      const verifier = new RecaptchaVerifier(auth, el, { size: "invisible" });
      verifierRef.current = verifier;

      const session = await multiFactor(user).getSession();
      const provider = new PhoneAuthProvider(auth);

      const vid = await provider.verifyPhoneNumber(
        { phoneNumber: normalized, session },
        verifier,
      );

      setVerificationId(vid);
      setStep("code");
    } catch (e: any) {
      console.error(e);

      if (e?.code === "auth/requires-recent-login") {
        setNeedsReauth(true);
      }

      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndEnroll() {
    setError("");
    setNeedsReauth(false);

    const user = auth.currentUser;
    if (!user) {
      router.replace(`/auth?next=${encodeURIComponent(`/mfa/enroll?next=${encodeURIComponent(nextDecoded)}`)}`);
      return;
    }

    const otp = code.trim();
    if (otp.length < 4) {
      setError("Enter the code we sent you.");
      return;
    }

    setBusy(true);
    try {
      const cred = PhoneAuthProvider.credential(verificationId, otp);
      const assertion = PhoneMultiFactorGenerator.assertion(cred);

      await multiFactor(user).enroll(assertion, "SMS");

      // Record in Firestore (optional but useful for UI)
      await setDoc(
        doc(db, "users", user.uid),
        { mfaEnrolled: true, updatedAt: serverTimestamp() },
        { merge: true },
      );

      router.replace(nextDecoded);
    } catch (e: any) {
      console.error(e);

      if (e?.code === "auth/requires-recent-login") {
        setNeedsReauth(true);
      }

      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[#0a1a2f] text-[#eaeaea] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="text-sm font-semibold">Secure your account</div>
        <div className="mt-2 text-sm text-white/75">
          Add a phone number to protect your progress. You can do this now or later.
        </div>

        {/* Force a fresh container per attempt */}
        <div key={captchaKey} id="recaptcha-container" className="mt-4" />

        {step === "phone" ? (
          <div className="mt-6 grid gap-3">
            <label className="text-xs text-white/70">Mobile number</label>
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/40 focus:border-white/25"
              placeholder="07…"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
            />
            <div className="text-xs text-white/55">
              You can type <span className="text-white/75">07…</span> or{" "}
              <span className="text-white/75">+44…</span> — we’ll handle the format.
            </div>

            {error ? (
              <>
                <pre className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-rose-100">
                  {error}
                </pre>
                {needsReauth ? (
                  <button
                    className="btn btn-outline"
                    onClick={() =>
                      router.replace(
                        `/auth?reauth=1&next=${encodeURIComponent(
                          `/mfa/enroll?next=${encodeURIComponent(nextDecoded)}`,
                        )}`,
                      )
                    }
                    disabled={busy}
                    type="button"
                  >
                    Re‑authenticate
                  </button>
                ) : null}
              </>
            ) : null}

            <button
              className="btn btn-primary mt-2"
              onClick={sendCode}
              disabled={busy}
              type="button"
            >
              {busy ? "Sending…" : "Continue"}
            </button>

            <button
              className="btn btn-ghost"
              onClick={() => router.replace(nextDecoded)}
              type="button"
            >
              Skip for now
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            <label className="text-xs text-white/70">Verification code</label>
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/40 focus:border-white/25"
              placeholder="Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
            />

            {error ? (
              <>
                <pre className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-rose-100">
                  {error}
                </pre>
                {needsReauth ? (
                  <button
                    className="btn btn-outline"
                    onClick={() =>
                      router.replace(
                        `/auth?reauth=1&next=${encodeURIComponent(
                          `/mfa/enroll?next=${encodeURIComponent(nextDecoded)}`,
                        )}`,
                      )
                    }
                    disabled={busy}
                    type="button"
                  >
                    Re‑authenticate
                  </button>
                ) : null}
              </>
            ) : null}

            <button
              className="btn btn-primary mt-2"
              onClick={verifyAndEnroll}
              disabled={busy}
              type="button"
            >
              {busy ? "Verifying…" : "Finish"}
            </button>

            <button
              className="btn btn-outline"
              onClick={() => {
                setCode("");
                setVerificationId("");
                setStep("phone");
              }}
              disabled={busy}
              type="button"
            >
              Change number
            </button>

            <button
              className="btn btn-ghost"
              onClick={() => router.replace(nextDecoded)}
              type="button"
            >
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}