"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BookOpen,
  Zap,
  TrendingUp,
  User,
  X,
  Menu,
  NotebookTabs,
  Gavel,
  GavelIcon,
  FileBadge,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV: NavItem[] = [
  { href: "/app", label: "Home", hint: "Dashboard", icon: Home },
  { href: "/app/learn", label: "Learn", hint: "Topics", icon: BookOpen },
  { href: "/app/revise", label: "Revise", hint: "Quickfire + review", icon: Zap },
  { href: "/app/notes", label: "Notes", hint: "Topic notes", icon: NotebookTabs },
  { href: "/app/statutes", label: "Statutes", hint: "Important statutes", icon: FileBadge },
  { href: "/app/cases", label: "Cases", hint: "Important cases", icon: GavelIcon },
  { href: "/app/progress", label: "Progress", hint: "Trends + insights", icon: TrendingUp },
  { href: "/app/account", label: "Account", hint: "Billing + settings", icon: User },
];

export function Sidebar({
  collapsed,
  onClose,
  onOpenNav,
}: {
  collapsed?: boolean;
  onClose?: () => void;
  onOpenNav?: () => void;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  // hard-kill underline even if some global CSS is being aggressive
  const noUnderlineStyle: React.CSSProperties = { textDecoration: "none" };

  return (
    <aside className="h-full w-full border-r border-white/10 bg-[#0a1a2f]/70 backdrop-blur">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-5">
          <Link
            href="/app"
            aria-label="SQEz home"
            style={noUnderlineStyle}
            className="flex items-center gap-3 no-underline! hover:no-underline! focus:no-underline!"
          >
            <img src="/sqez-logo.svg" alt="SQEz" className="h-5 w-auto" />
            <span className="sr-only">SQEz</span>
          </Link>

          <div className="flex items-center gap-2 lg:hidden">
            {onOpenNav ? (
              <button
                type="button"
                className="btn btn-ghost px-3 py-2"
                onClick={onOpenNav}
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
            ) : null}

            {onClose ? (
              <button
                type="button"
                className="btn btn-ghost px-3 py-2"
                onClick={onClose}
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3">
          <ul className="grid gap-2">
            {NAV.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    style={noUnderlineStyle}
                    className={[
                      "group flex items-center gap-4 rounded-xl px-3 py-3.5 transition",
                      "no-underline! hover:no-underline! focus:no-underline!",
                      active
                        ? "bg-white/10 text-white"
                        : "text-white/80 hover:bg-white/5 hover:text-white",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "grid h-9 w-9 place-items-center rounded-xl border transition",
                        active
                          ? "border-white/15 bg-white/10"
                          : "border-white/10 bg-white/5 group-hover:border-white/15 group-hover:bg-white/8",
                      ].join(" ")}
                      aria-hidden
                    >
                      <Icon className="h-4 w-4" />
                    </span>

                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-none">
                        {item.label}
                      </div>
                      {!collapsed && item.hint ? (
                        <div className="mt-1 text-xs text-white/55">
                          {item.hint}
                        </div>
                      ) : null}
                    </div>

                    {/* subtle active indicator */}
                    <span
                      className={[
                        "ml-auto h-2 w-2 rounded-full transition",
                        active ? "bg-emerald-400" : "bg-transparent group-hover:bg-white/25",
                      ].join(" ")}
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="mt-auto px-4 pb-6">
          <div className="rounded-2xl bg-white/5 px-4 py-4">
            <div className="text-xs text-white/50">Tip</div>
            <div className="mt-1 text-sm text-white/80 leading-snug">
              Short, regular sessions beat long cramming.
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}