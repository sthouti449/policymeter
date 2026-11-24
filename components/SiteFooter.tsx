import Link from "next/link";
import { LogoMark } from "./Logo";

const PRODUCT = [
  { href: "/chat", label: "Policy Assistant" },
  { href: "/dashboard", label: "Cost Dashboard" },
  { href: "/evals", label: "Evals" },
  { href: "/architecture", label: "Architecture" },
];

export function SiteFooter() {
  const builder = process.env.NEXT_PUBLIC_BUILDER_NAME ?? "the builder";
  const links = [
    { label: "LinkedIn", href: process.env.NEXT_PUBLIC_LINKEDIN_URL },
    { label: "GitHub", href: process.env.NEXT_PUBLIC_GITHUB_URL },
  ].filter((l): l is { label: string; href: string } => !!l.href);

  return (
    <footer className="mt-20 border-t border-ink-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark size={30} />
            <span className="text-base font-semibold text-ink-900">PolicyMeter</span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-500">
            Cited answers about Virginia AI policy, with every model call metered by agency and use case.
          </p>
        </div>
        <nav aria-label="Product">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-500">Product</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {PRODUCT.map((l) => (
              <li key={l.href}><Link href={l.href} className="text-ink-700 hover:text-brand-700 hover:underline">{l.label}</Link></li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-500">Builder</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {links.map((l) => (
              <li key={l.label}><a href={l.href} target="_blank" rel="noreferrer" className="text-ink-700 hover:text-brand-700 hover:underline">{l.label}</a></li>
            ))}
            {links.length === 0 && <li className="text-ink-500">{builder}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-100">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs leading-relaxed text-ink-500">
          Independent demo. Not affiliated with or endorsed by VITA or the Commonwealth of Virginia. Built by {builder}.
        </p>
      </div>
    </footer>
  );
}
