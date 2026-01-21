"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  hint?: string;
};

const NAV: NavItem[] = [
  { href: "/app", label: "Home", hint: "Dashboard" },
  { href: "/app/learn", label: "Learn", hint: "Topics" },
  { href: "/app/revise", label: "Revise", hint: "Quickfire + review" },
  { href: "/app/progress", label: "Progress", hint: "Trends + insights" },
  { href: "/app/account", label: "Account", hint: "Billing + settings" },
];

export function Sidebar({
  collapsed,
  onClose,
}: {
  collapsed?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  return (
    <aside
      className={[
        "h-full w-full",
        "border-r border-white/10",
        "bg-white/2",
      ].join(" ")}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3" aria-label="SQEz home">
            <img src="/sqez-logo.svg" alt="SQEz" className="h-5 w-auto" />
            <span className="sr-only">SQEz</span>
          </Link>

          {onClose ? (
            <button
              type="button"
              className="btn btn-ghost px-3 py-2 lg:hidden"
              onClick={onClose}
              aria-label="Close navigation"
            >
              Close
            </button>
          ) : null}
        </div>

        <nav className="px-2 pb-4">
          <ul className="grid gap-1">
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={[
                      "group flex items-start justify-between gap-3 rounded-xl px-3 py-3",
                      "border",
                      active
                        ? "border-white/15 bg-white/7"
                        : "border-transparent hover:border-white/10 hover:bg-white/5",
                    ].join(" ")}
                    aria-current={active ? "page" : undefined}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white">
                        {item.label}
                      </div>
                      {!collapsed && item.hint ? (
                        <div className="mt-1 text-xs text-white/60">
                          {item.hint}
                        </div>
                      ) : null}
                    </div>

                    {active ? (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                    ) : (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-transparent group-hover:bg-white/20" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto px-4 pb-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-xs text-white/60">Quick tip</div>
            <div className="mt-1 text-sm text-white/80">
              Short sessions win. Aim for consistency, not intensity.
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}