import type { Source } from "@/lib/chat/types";

// Status is always written out as a word, so colour is never the only signal.
const STYLES: Record<Source["status"], string> = {
  current: "bg-mint-100 text-mint-600 ring-mint-600/20",
  rescinded: "bg-red-50 text-red-700 ring-red-600/20",
  historical: "bg-amber-50 text-amber-800 ring-amber-600/25",
};

export function StatusBadge({ status }: { status: Source["status"] }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${STYLES[status]}`}>{status}</span>;
}
