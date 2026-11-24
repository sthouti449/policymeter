import "server-only";
import { createHash } from "node:crypto";
import { getSupabase } from "@/lib/db/supabase";
import { getEnv } from "@/lib/env";

/** Only a salted hash of the IP is ever stored, never the address itself. */
export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(ip + salt).digest("hex");
}

/** Best-effort client IP behind Vercel's proxy. */
export function clientIp(headers: { get(name: string): string | null }): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

/** Dashboard reads get their own, higher limit (a page load makes several calls). Separate bucket: the hash is salted differently. */
export async function checkReadRateLimit(headers: { get(name: string): string | null }): Promise<boolean> {
  const { env } = getEnv();
  const { data, error } = await getSupabase().rpc("hit_rate_limit", {
    p_ip_hash: hashIp(`${clientIp(headers)}|read`, env.IP_HASH_SALT),
    p_limit: env.RATE_LIMIT_READS_PER_MINUTE,
  });
  if (error) throw new Error(`read rate limit check failed: ${error.message}`);
  return data === true;
}

/** true = allowed. Counting is atomic in the hit_rate_limit SQL function. */
export async function checkRateLimit(ipHash: string): Promise<boolean> {
  const { data, error } = await getSupabase().rpc("hit_rate_limit", {
    p_ip_hash: ipHash,
    p_limit: getEnv().env.RATE_LIMIT_PER_MINUTE,
  });
  if (error) throw new Error(`rate limit check failed: ${error.message}`);
  return data === true;
}
