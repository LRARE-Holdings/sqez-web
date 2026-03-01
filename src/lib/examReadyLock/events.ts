import * as Sentry from "@sentry/nextjs";

export type ExamReadyEventName =
  | "lock_would_block"
  | "lock_blocked"
  | "lock_override_used";

export function logExamReadyEvent(
  name: ExamReadyEventName,
  payload: Record<string, unknown> = {},
) {
  const event = {
    event: `exam_ready_lock:${name}`,
    ...payload,
    at: new Date().toISOString(),
  };

  if (process.env.NODE_ENV !== "production") {
    // Keep this visible during rollout without polluting the UI.
    console.info("[exam-ready-lock]", event);
  }

  try {
    Sentry.captureMessage(`exam_ready_lock:${name}`, {
      level: "info",
      extra: event,
    });
  } catch {
    // No-op if Sentry is unavailable.
  }
}

