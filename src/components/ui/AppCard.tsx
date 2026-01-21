import React from "react";

export function AppCard({
  title,
  subtitle,
  right,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className ?? ""}`.trim()}>
      {title || subtitle || right ? (
        <header className="flex items-start justify-between gap-4">
          <div>
            {title ? (
              <h2 className="text-sm font-semibold tracking-tight text-white">
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-xs leading-relaxed text-white/70">
                {subtitle}
              </p>
            ) : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </header>
      ) : null}

      <div className={title || subtitle || right ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

export function AppCardSoft({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card-soft ${className ?? ""}`.trim()}>{children}</section>
  );
}