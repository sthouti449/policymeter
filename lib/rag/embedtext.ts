/**
 * The text that is EMBEDDED for a chunk: the document title, then the chunk itself.
 *
 * A chunk from the middle of a long document often never names the document ("The Task Force shall be
 * co-led by..."). Questions often do ("the AI Utilization Policy", "the AI technology standard"), so the
 * embedding of the bare chunk can sit far from the question. Putting the title in front of the text that
 * gets embedded lets the question match on it. Only the embedding changes: the chunk shown to the model
 * and to users is still the plain text, so citations and quotes are unaffected.
 */
export function embeddingText(title: string | undefined, content: string): string {
  return title ? `${title}\n\n${content}` : content;
}
