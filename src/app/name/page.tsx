"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";
import { sanitizeNextPath } from "@/lib/navigation";

export default function NamePage() {
  const router = useRouter();
  const params = useSearchParams();

  const nextDecoded = useMemo(
    () => sanitizeNextPath(params.get("next"), "/verify-email"),
    [params],
  );

  const [checking, setChecking] = useState(true);
  const [uid, setUid] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        const returnTo = encodeURIComponent(`/name?next=${encodeURIComponent(nextDecoded)}`);
        router.replace(`/auth?next=${returnTo}`);
        return;
      }

      setUid(user.uid);

      // Try prefill from Firestore first
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as { firstName?: string; lastName?: string };
          if (typeof data.firstName === "string" && data.firstName.trim()) {
            setFirstName(data.firstName.trim());
          }
          if (typeof data.lastName === "string" && data.lastName.trim()) {
            setLastName(data.lastName.trim());
          }
        }
      } catch {
        // ignore prefill failures
      }

      // Fallback prefill from Firebase displayName if present
      if ((!firstName || !lastName) && user.displayName) {
        const parts = user.displayName.split(" ").filter(Boolean);
        if (!firstName && parts[0]) setFirstName(parts[0]);
        if (!lastName && parts.length > 1) setLastName(parts.slice(1).join(" "));
      }

      setChecking(false);
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, nextDecoded]);

  async function save() {
    setError("");
    if (!uid) return;

    const f = firstName.trim();
    const l = lastName.trim();

    if (!f) {
      setError("Please enter your first name.");
      return;
    }
    if (!l) {
      setError("Please enter your last name.");
      return;
    }

    setBusy(true);
    try {
      await setDoc(
        doc(db, "users", uid),
        {
          firstName: f,
          lastName: l,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      router.replace(nextDecoded);
    } catch (e: any) {
      setError(e?.message || "Couldn’t save your name. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-dvh bg-[#0a1a2f] text-[#eaeaea] flex items-center justify-center px-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-white/80">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#0a1a2f] text-[#eaeaea] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="text-sm font-semibold">What should we call you?</div>
        <div className="mt-2 text-sm text-white/75">
          This helps us personalise SQEz and keep your account tidy.
        </div>

        <div className="mt-6 grid gap-4">
          <div>
            <label className="block text-xs text-white/70" htmlFor="firstName">
              First name
            </label>
            <input
              id="firstName"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/40 focus:border-white/25"
              placeholder="e.g. Alex"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
          </div>

          <div>
            <label className="block text-xs text-white/70" htmlFor="lastName">
              Last name
            </label>
            <input
              id="lastName"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/40 focus:border-white/25"
              placeholder="e.g. Smith"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </div>

          {error ? <div className="text-sm text-rose-200">{error}</div> : null}

          <button
            type="button"
            className="btn btn-primary mt-1"
            onClick={save}
            disabled={busy}
          >
            {busy ? "Saving…" : "Continue"}
          </button>

          <div className="text-xs text-white/55">
            You’ll be able to change this later in Account.
          </div>
        </div>
      </div>
    </div>
  );
}
