// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const clientDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

function parseNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

Sentry.init({
  dsn: clientDsn,
  enabled: Boolean(clientDsn),

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: parseNumberEnv("NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE", 0.1),
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: parseNumberEnv(
    "NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE",
    0.02,
  ),

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: parseNumberEnv(
    "NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE",
    0.2,
  ),

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: process.env.NEXT_PUBLIC_SENTRY_SEND_DEFAULT_PII === "1",
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
