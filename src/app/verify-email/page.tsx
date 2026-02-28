"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, sendEmailVerification } from "firebase/auth";

import { auth } from "@/lib/firebase/client";
import { sanitizeNextPath } from "@/lib/navigation";

type FirebaseErrorLike = {
  code?: string;
  message?: string;
};

function asFirebaseError(err: unknown): FirebaseErrorLike {
  if (!err || typeof err !== "object") return {};
  const code = "code" in err && typeof err.code === "string" ? err.code : undefined;
  const message =
    "message" in err && typeof err.message === "string"
      ? err.message
      : undefined;
  return { code, message };
}

export default function VerifyEmailPage() {
  const router = useRouter();
  const params = useSearchParams();

  const next = sanitizeNextPath(params.get("next"), "/onboarding");

  const [status, setStatus] = useState<
    "checking" | "needs-verify" | "sending" | "sent" | "error"
  >("checking");
  const [error, setError] = useState<string>("");
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const autoSentRef = useRef(false);

  const LS_KEY = "sqez_verify_email_last_sent_at";

  function getLastSentAt() {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem(LS_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  }

  function markSentNow() {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_KEY, String(Date.now()));
  }

  function canSendNow() {
    const now = Date.now();
    if (cooldownUntil && now < cooldownUntil) return false;

    // Hard throttle: don’t send more than once every 60s from this device.
    const last = getLastSentAt();
    return !(last && now - last < 60_000);
  }

  function startCooldown(ms: number) {
    const now = Date.now();
    setNowMs(now);
    setCooldownUntil(now + ms);
  }

  useEffect(() => {
    if (cooldownUntil <= nowMs) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil, nowMs]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace(`/auth?next=${encodeURIComponent("/verify-email")}`);
        return;
      }

      // Ensure we have the latest emailVerified flag
      await user.reload();

      if (user.emailVerified) {
        router.replace(next);
        return;
      }

      setStatus("needs-verify");

      // Auto-send once when landing here (users may have arrived via login/deep link)
      if (!autoSentRef.current) {
        autoSentRef.current = true;

        if (!canSendNow()) {
          // Don’t auto-send if we recently sent one from this device
          return;
        }

        try {
          setStatus("sending");
          await sendEmailVerification(user);
          markSentNow();
          setStatus("sent");
        } catch (e: unknown) {
          const parsed = asFirebaseError(e);
          console.error(e);

          if (parsed.code === "auth/too-many-requests") {
            setError("Too many attempts. Please wait a minute, then tap “Resend email”.");
            startCooldown(60_000);
          }

          // Fall back to manual resend button
          setStatus("needs-verify");
        }
      }
    });

    return () => unsub();
  }, [router, next]);

  async function resend() {
    setError("");
    if (!canSendNow()) {
      setError("Please wait a moment before requesting another email.");
      return;
    }
    const user = auth.currentUser;
    if (!user) return;

    try {
      setStatus("sending");
      await sendEmailVerification(user);
      markSentNow();
      setStatus("sent");
    } catch (e: unknown) {
      const parsed = asFirebaseError(e);
      if (parsed.code === "auth/too-many-requests") {
        setStatus("needs-verify");
        setError("Too many attempts. Please wait a minute, then try again.");
        startCooldown(60_000);
        return;
      }
      console.error(e);
      setStatus("error");
      setError(parsed.message || "Couldn’t send the email. Please try again.");
    }
  }

  async function iveVerified() {
    setError("");
    const user = auth.currentUser;
    if (!user) return;

    try {
      setStatus("checking");
      await user.reload();
      if (user.emailVerified) {
        router.replace(next);
      } else {
        setStatus("needs-verify");
        setError("Still not verified yet — try refreshing your inbox.");
      }
    } catch (e: unknown) {
      const parsed = asFirebaseError(e);
      console.error(e);
      setStatus("error");
      setError(parsed.message || "Couldn’t refresh status. Please try again.");
    }
  }

  return (
    <div className="min-h-dvh bg-[#0a1a2f] text-[#eaeaea] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="text-sm font-semibold">Verify your email</div>
        <div className="mt-2 text-sm text-white/75">
          We’ll email you a verification link. Once you’ve verified, come back here and tap
          <span className="text-white/90"> I’ve verified</span>.
        </div>

        {error ? <div className="mt-4 text-sm text-rose-200">{error}</div> : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="btn btn-primary w-full sm:w-auto"
            onClick={iveVerified}
            disabled={status === "checking" || status === "sending"}
          >
            I’ve verified
          </button>

          <button
            type="button"
            className="btn btn-outline w-full sm:w-auto"
            onClick={resend}
            disabled={status === "sending" || nowMs < cooldownUntil}
          >
            {status === "sending" ? "Sending…" : "Resend email"}
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
          Tip: if you can’t see it, check spam/junk. Some inboxes delay verification emails. If you request too many emails, you may need to wait a minute before trying again.
        </div>
      </div>
    </div>
  );
}
