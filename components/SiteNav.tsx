"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/chat", label: "Policy Assistant" },
  { href: "/dashboard", label: "Cost Dashboard" },
  { href: "/evals", label: "Evals" },
  { href: "/architecture", label: "Architecture" },
];

/**
 * Sticky top bar. The current page gets a filled pill AND aria-current, so it is not shown by colour alone.
 * On narrow screens the links scroll sideways instead of wrapping onto several lines.
 */
export function SiteNav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-white/80 backdrop-blur-md">
      <nav aria-label="Main" className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-lg">
          <LogoMark />
          <span className="text-[17px] font-semibold tracking-tight text-ink-900">PolicyMeter</span>
        </Link>
        <ul className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 sm:justify-end">
          {LINKS.map((l) => {
            const current = path === l.href || path.startsWith(`${l.href}/`);
            return (
              <li key={l.href} className="shrink-0">
                <Link
                  href={l.href}
                  aria-current={current ? "page" : undefined}
                  className={`block rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    current ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <ThemeToggle />
      </nav>
    </header>
  );
}
