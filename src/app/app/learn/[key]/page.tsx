import Link from "next/link";
import { byJsonKey } from "@/lib/topicCatalog";

export default function TopicDetailPage({
  params,
}: {
  params: { key: string };
}) {
  const topic = byJsonKey(params.key);

  if (!topic) {
    return (
      <div className="card">
        <div className="text-sm font-semibold text-white">Topic not found</div>
        <div className="mt-2 text-sm text-white/70">
          Unknown topic key: <span className="text-white/80">{params.key}</span>
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
      <div className="text-xs text-white/60">{topic.module}</div>
      <div className="mt-2 text-xl font-semibold tracking-tight text-white">
        {topic.title}
      </div>
      <div className="mt-3 text-sm leading-relaxed text-white/80">
        {topic.overview}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link href="/app/session" className="btn btn-primary w-full sm:w-auto">
          Start Quickfire
        </Link>
        <Link href="/app/revise" className="btn btn-outline w-full sm:w-auto">
          Revise
        </Link>
        <Link href="/app/learn" className="btn btn-ghost w-full sm:w-auto">
          Back
        </Link>
      </div>

      <div className="mt-4 text-xs text-white/60">
        Canonical JSON: <span className="text-white/70">{topic.fileName}</span>
      </div>
    </div>
  );
}