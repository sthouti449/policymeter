import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getAgencies, getPricing } from "@/lib/config";

export const metadata = { title: "Cost Dashboard" };

export default function DashboardPage() {
  const cfg = getAgencies();
  return (
    <DashboardClient
      agencies={cfg.agencies.map((a) => ({ value: a.code, label: a.code }))}
      useCases={cfg.use_cases.map((u) => ({ value: u.code, label: u.name }))}
      models={Object.entries(getPricing().models).map(([key, p]) => ({ value: key, label: p.label }))}
    />
  );
}
