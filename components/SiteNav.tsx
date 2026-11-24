"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/chat", label: "Policy Assistant" },
  { href: "/dashboard", label: "Cost Dashboard" },
  { href: "/evals", label: "Evals" },
  { href: "/architecture", label: "Architecture" },
];

/** Top navigation. The current page is marked with aria-current and an underline (not colour alone). */
export function SiteNav() {
  const path = usePathname();
  return (
    <header className="border-b bg-white">
      <nav aria-label="Main" className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 text-sm">
        <Link href="/" className="mr-2 font-semibold">PolicyMeter</Link>
        {LINKS.slice(1).map((l) => {
          const current = path === l.href || path.startsWith(`${l.href}/`);
          return (
            <Link key={l.href} href={l.href} aria-current={current ? "page" : undefined}
              className={current ? "font-medium underline decoration-2 underline-offset-4" : "text-neutral-700 hover:underline"}>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
