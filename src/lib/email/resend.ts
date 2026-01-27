import { Resend } from "resend";

/**
 * Server-only Resend adapter.
 *
 * Rules:
 * - Never import this from client components.
 * - Validate env vars early so failures are loud.
 */

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey || !String(apiKey).trim()) {
  throw new Error("Missing RESEND_API_KEY env var");
}

const resend = new Resend(String(apiKey).trim());

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Missing ${name} env var`);
  return String(v).trim();
}

function safeTrim(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export type FreeTrialEmailParams = {
  customerEmail: string;
  firstName?: string | null;
  planLabel: string;
  /** Human-readable date string, e.g. "12 October 2026" */
  trialEndsAt: string;
};

/**
 * Sends the “free trial started” email.
 *
 * Template variables expected (per your Resend template builder):
 * - firstName
 * - planLabel
 * - trialEndsAt
 */
export async function sendFreeTrialEmail(params: FreeTrialEmailParams) {
  const from = requireEnv("RESEND_FROM");

  // Template alias/name from Resend template builder, e.g. "free-trial".
  // Keep it configurable per environment.
  const template = requireEnv("RESEND_FREE_TRIAL_TEMPLATE");

  const to = safeTrim(params.customerEmail);
  if (!to) throw new Error("Missing customerEmail");

  const replyTo = safeTrim(process.env.RESEND_REPLY_TO) || "support@lrare.co.uk";

  const { data, error } = await resend.emails.send({
    from,
    to,
    replyTo,
    template: {
      id: template,
      variables: {
        firstName: safeTrim(params.firstName) || "",
        planLabel: safeTrim(params.planLabel),
        trialEndsAt: safeTrim(params.trialEndsAt),
      },
    },
  });

  if (error) {
    // Bubble up so callers (e.g. Stripe webhook) log the real reason.
    throw new Error(`Resend sendFreeTrialEmail failed: ${error.message}`);
  }

  return data;
}