/**
 * Reciprocal rank fusion: merge several ranked lists of chunk ids into one.
 * Each list gives an item 1/(k + rank) points (rank starts at 1); points add up.
 * It needs no score scaling between vector and keyword search, which is why we
 * use it. k = 60 is the standard constant.
 */
export function rrf(lists: number[][], k = 60): number[] {
  const score = new Map<number, number>();
  for (const list of lists) {
    list.forEach((id, i) => score.set(id, (score.get(id) ?? 0) + 1 / (k + i + 1)));
  }
  // Ties keep first-seen order (Map preserves insertion), so results are stable.
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
