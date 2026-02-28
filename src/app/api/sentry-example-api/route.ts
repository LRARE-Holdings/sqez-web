import * as Sentry from "@sentry/nextjs";
export const dynamic = "force-dynamic";

function sentryExampleEnabled() {
  if (process.env.ENABLE_SENTRY_EXAMPLE_ROUTES === "1") return true;
  return process.env.NODE_ENV !== "production";
}

class SentryExampleAPIError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SentryExampleAPIError";
  }
}

// A faulty API route to test Sentry's error monitoring
export function GET() {
  if (!sentryExampleEnabled()) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  Sentry.logger.info("Sentry example API called");
  throw new SentryExampleAPIError(
    "This error is raised on the backend called by the example page.",
  );
}
