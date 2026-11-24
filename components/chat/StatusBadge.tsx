import type { Source } from "@/lib/chat/types";

const STYLES: Record<Source["status"], string> = {
  current: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rescinded: "bg-red-50 text-red-700 ring-red-200",
  historical: "bg-amber-50 text-amber-700 ring-amber-200",
};

export function StatusBadge({ status }: { status: Source["status"] }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}>{status}</span>;
}
