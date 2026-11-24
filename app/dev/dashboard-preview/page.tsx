import { notFound } from "next/navigation";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getAgencies, getPricing } from "@/lib/config";

// TEMPORARY (removed in Stage 7): the real dashboard UI, fed by fixture data.
export const dynamic = "force-dynamic";

export default function DashboardPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const cfg = getAgencies();
  return (
    <>
      <p className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">PREVIEW with fixture data. Filters other than the date range are ignored here. The real page is /dashboard.</p>
      <DashboardClient
        apiBase="/api/dev/preview"
        agencies={cfg.agencies.map((a) => ({ value: a.code, label: a.code }))}
        useCases={cfg.use_cases.map((u) => ({ value: u.code, label: u.name }))}
        models={Object.entries(getPricing().models).map(([key, p]) => ({ value: key, label: p.label }))}
      />
    </>
  );
}
