import { getPrice } from "@/lib/config";
import type { Usage } from "@/lib/llm/types";

/**
 * Cost in USD from the usage the provider returned (ARCHITECTURE section 4).
 * Prices are per 1M tokens. inputTokens already includes cached tokens, so the
 * fresh part is what is left after subtracting cache reads and cache writes.
 * Unrounded: rounding happens only for display (and numeric(12,8) in the DB).
 * An unknown pricing key throws, so a typo can never silently cost $0.
 */
export function computeCost(usage: Usage, pricingKey: string): number {
  const p = getPrice(pricingKey);
  const fresh = Math.max(0, usage.inputTokens - usage.cachedInputTokens - usage.cacheWriteTokens);
  return (
    (fresh * p.input +
      usage.cachedInputTokens * p.cached_input +
      usage.cacheWriteTokens * p.cache_write +
      usage.outputTokens * p.output) /
    1e6
  );
}
