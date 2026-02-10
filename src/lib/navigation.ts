export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Restrict post-auth redirects to internal app paths only.
 * Rejects protocol URLs, protocol-relative URLs, and malformed values.
 */
export function sanitizeNextPath(
  input: string | null | undefined,
  fallback: string,
): string {
  if (!input) return fallback;

  const decoded = safeDecode(String(input)).trim();
  if (!decoded) return fallback;

  if (!decoded.startsWith("/")) return fallback;
  if (decoded.startsWith("//")) return fallback;
  if (decoded.includes("\n") || decoded.includes("\r")) return fallback;

  return decoded;
}
