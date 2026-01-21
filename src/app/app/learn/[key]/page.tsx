import Link from "next/link";
import { allTopics } from "@/lib/topicCatalog";

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function compact(s: string): string {
  return s.replace(/\s+/g, "").trim();
}

function resolveTopic(param: string) {
  const raw = (param ?? "").trim();
  const decoded = safeDecode(raw);

  const rawLower = raw.toLowerCase();
  const decodedLower = decoded.toLowerCase();

  const compactRawLower = compact(rawLower);
  const compactDecodedLower = compact(decodedLower);

  // 1) Match by canonical key (case-insensitive), including compacted forms
  const byKey =
    allTopics.find((t) => t.key.toLowerCase() === rawLower) ??
    allTopics.find((t) => t.key.toLowerCase() === decodedLower) ??
    allTopics.find((t) => t.key.toLowerCase() === compactRawLower) ??
    allTopics.find((t) => t.key.toLowerCase() === compactDecodedLower);

  if (byKey) return byKey;

  // 2) Match by exact title (case-insensitive)
  const byTitle =
    allTopics.find((t) => t.title.toLowerCase() === decodedLower) ??
    allTopics.find((t) => t.title.toLowerCase() === rawLower);

  if (byTitle) return byTitle;

  // 3) Match by compacted title vs compacted param
  const byCompactedTitle = allTopics.find(
    (t) => compact(t.title.toLowerCase()) === compactDecodedLower,
  );

  if (byCompactedTitle) return byCompactedTitle;

  // 4) Loose fallback
  return allTopics.find((t) => {
    const tKey = t.key.toLowerCase();
    const tTitle = t.title.toLowerCase();
    return (
      tKey.includes(compactDecodedLower) ||
      tTitle.includes(decodedLower) ||
      compact(tTitle).includes(compactDecodedLower)
    );
  });
}

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const rawKey = (key ?? "").trim();

  const topic = rawKey ? resolveTopic(rawKey) : undefined;

  if (!topic) {
    return (
      <div className="card">
        <div className="text-sm font-semibold text-white">Topic not found</div>
        <div className="mt-1 text-xs text-white/50">debug route v3</div>
        <div className="mt-2 text-sm text-white/70">
          Unknown topic key:{" "}
          <span className="text-white/80">{rawKey || "(empty)"}</span>
        </div>
        <div className="mt-2 text-sm text-white/70">
          Expected format: canonical key like{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-xs text-white/80">
            DisputeResolution
          </code>
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="text-xs font-semibold text-white/80">Debug</div>
          <div className="mt-2 text-xs text-white/60">
            params.key (raw):{" "}
            <span className="text-white/80">
              {rawKey || "(empty)"}{" "}
              <span className="text-white/50">({JSON.stringify(rawKey)})</span>
            </span>
          </div>
          <div className="mt-2 text-xs text-white/60">
            char codes:{" "}
            <span className="text-white/80">
              {rawKey
                ? rawKey.split("").map((c) => c.charCodeAt(0)).join(", ")
                : "(empty)"}
            </span>
          </div>
          <div className="mt-2 text-xs text-white/60">
            decoded:{" "}
            <span className="text-white/80">
              {safeDecode(rawKey)}{" "}
              <span className="text-white/50">
                ({JSON.stringify(safeDecode(rawKey))})
              </span>
            </span>
          </div>
          <div className="mt-2 text-xs text-white/60">
            compact(decoded).toLowerCase():{" "}
            <span className="text-white/80">
              {compact(safeDecode(rawKey).toLowerCase())}
            </span>
          </div>
          <div className="mt-2 text-xs text-white/60">
            resolveTopic(rawKey) returns:{" "}
            <span className="text-white/80">
              {String(Boolean(rawKey && resolveTopic(rawKey)))}
            </span>
          </div>
          <div className="mt-2 text-xs text-white/60">
            allTopics length:{" "}
            <span className="text-white/80">{allTopics.length}</span>
          </div>
          <div className="mt-2 text-xs text-white/60">
            Looking for key:{" "}
            <span className="text-white/80">DisputeResolution</span>
          </div>
          <div className="mt-2 text-xs text-white/60">
            Has DisputeResolution:{" "}
            <span className="text-white/80">
              {String(
                allTopics.some(
                  (t) => (t.key ?? "").toLowerCase() === "disputeresolution",
                ),
              )}
            </span>
          </div>
          <div className="mt-3 text-xs text-white/60">First topics:</div>
          <ul className="mt-2 grid gap-1 text-xs text-white/70">
            {allTopics.slice(0, 25).map((t) => (
              <li key={t.key}>
                <span className="text-white/80">{t.key}</span>{" "}
                <span className="text-white/50">—</span>{" "}
                <span>{t.title}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-5">
          <Link href="/app/learn" className="btn btn-primary w-full sm:w-auto">
            Back to Learn
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="text-xs text-white/50">route v3 • key: {key}</div>
      <div className="text-xs text-white/60">{topic.module}</div>
      <div className="mt-2 text-xl font-semibold tracking-tight text-white">
        {topic.title}
      </div>
      <div className="mt-3 text-sm leading-relaxed text-white/80">
        {topic.overview}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/app/session?topic=${encodeURIComponent(topic.key)}`}
          className="btn btn-primary w-full sm:w-auto"
        >
          Start Quickfire
        </Link>
        <Link
          href={`/app/revise?topic=${encodeURIComponent(topic.key)}`}
          className="btn btn-outline w-full sm:w-auto"
        >
          Revise
        </Link>
        <Link href="/app/learn" className="btn btn-ghost w-full sm:w-auto">
          Back
        </Link>
      </div>

    </div>
  );
}