import { ChatClient } from "@/components/chat/ChatClient";
import { getAgencies } from "@/lib/config";
import { getSupabase } from "@/lib/db/supabase";
import { INTERNAL_USE_CASES } from "@/lib/guardrails/input";

export const dynamic = "force-dynamic";
export const metadata = { title: "Policy Assistant" };

/** "Documents last ingested" comes from the database; a failure just shows "unknown". */
async function lastIngested(): Promise<string | null> {
  try {
    const { data } = await getSupabase()
      .from("documents").select("ingested_at").eq("corpus", "policy").order("ingested_at", { ascending: false }).limit(1);
    const at = data?.[0]?.ingested_at;
    return at ? new Date(at).toISOString().slice(0, 10) : null;
  } catch {
    return null;
  }
}

export default async function ChatPage() {
  const cfg = getAgencies();
  return (
    <ChatClient
      agencies={cfg.agencies.filter((a) => a.code !== "DEMO").map((a) => ({ code: a.code, name: a.name }))}
      useCases={cfg.use_cases.filter((u) => !INTERNAL_USE_CASES.includes(u.code) && u.code !== "reviewer-assistant")}
      lastIngested={await lastIngested()}
    />
  );
}
