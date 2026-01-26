import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function freeTrialHtml(params: {
  firstName?: string | null;
  planLabel: string;
  trialEndsAt: string;
}) {
  const firstName = (params.firstName ?? "").trim();
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,";

  const planLabel = escapeHtml(params.planLabel);
  const trialEndsAt = escapeHtml(params.trialEndsAt);

  // Keep this plain + reliable (Resend renders modern HTML well).
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Your free trial is active</title>
  </head>
  <body style="margin:0;padding:0;background:#0a1a2f;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    <div style="max-width:560px;margin:0 auto;padding:28px 18px;">
      <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:22px;">
        <div style="color:rgba(255,255,255,0.85);font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">
          SQEz Pro
        </div>

        <h1 style="margin:10px 0 0 0;color:#ffffff;font-size:20px;line-height:1.25;">
          Your free trial is now active
        </h1>

        <p style="margin:14px 0 0 0;color:rgba(255,255,255,0.78);font-size:14px;line-height:1.6;">
          ${greeting} You’ve started a <strong style="color:#fff;">${planLabel}</strong> free trial.
          You won’t be charged today.
        </p>

        <div style="margin:16px 0 0 0;padding:14px 14px;border-radius:14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.10);">
          <div style="color:rgba(255,255,255,0.65);font-size:12px;">Trial ends</div>
          <div style="margin-top:6px;color:#ffffff;font-size:16px;font-weight:600;">${trialEndsAt}</div>
          <div style="margin-top:8px;color:rgba(255,255,255,0.72);font-size:12px;line-height:1.5;">
            After this date, your subscription will start unless you cancel beforehand.
          </div>
        </div>

        <p style="margin:16px 0 0 0;color:rgba(255,255,255,0.72);font-size:12px;line-height:1.6;">
          Need help? Just reply to this email.
        </p>

        <div style="margin-top:18px;border-top:1px solid rgba(255,255,255,0.10);padding-top:14px;color:rgba(255,255,255,0.55);font-size:11px;line-height:1.5;">
          SQEz is a revision companion tool — not a prep-course replacement.
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export async function sendFreeTrialEmail(params: {
  customerEmail: string;
  firstName?: string | null;
  planLabel: string;
  trialEndsAt: string; // e.g. "12 October 2026"
}) {
  const from = process.env.RESEND_FROM;
  if (!from) {
    throw new Error("Missing RESEND_FROM env var");
  }

  // IMPORTANT: `to` must be the customer’s email address.
  // Your template alias/domain is for the sender identity (the `from`), not the recipient.
  await resend.emails.send({
    from,
    to: params.customerEmail,
    replyTo: "support@lrare.co.uk",
    template: {
      id: "free-trial", // published Resend template alias
      variables: {
        FIRST_NAME: params.firstName ?? "",
        PLAN_LABEL: params.planLabel,
        TRIAL_ENDS_AT: params.trialEndsAt,
      },
    },
  });
}