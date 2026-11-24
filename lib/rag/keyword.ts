// Keyword search needs a query the database can actually match.
//
// keyword_chunks() uses websearch_to_tsquery, which requires EVERY word to appear in a chunk. A natural
// question like "what risk framework does the technology standard draw on" never has all its words in
// one chunk, so keyword search returned nothing and hybrid search was really vector-only. Joining the
// words with "or" makes a chunk match when it contains ANY of them. ts_rank then puts chunks with
// more matching words first, and the database's English configuration drops stop words ("what",
// "does", "the") and stems the rest ("rescinded" matches "rescinds").

const MAX_TERMS = 12;

export function toKeywordQuery(question: string): string {
  const words = question.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  // Only these two words are special in websearch syntax once punctuation is gone.
  const plain = words.filter((w) => w !== "or" && w !== "and");
  return [...new Set(plain)].slice(0, MAX_TERMS).join(" or ");
}
