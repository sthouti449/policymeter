// Turn the model's [n] markers into something safe to show. The model can cite a
// number that was never in the context; those are removed (ARCHITECTURE step 8).

const GROUP = /\[(\d+(?:\s*,\s*\d+)*)\]/g; // matches [1] and [1, 2]

export interface CitationResult {
  text: string; // markers normalised to [1][2]; invalid ones removed
  used: number[]; // valid numbers, in order of first appearance
  dropped: number[]; // invalid numbers that were removed
}

/** sourceCount = how many numbered context blocks the model was given. */
export function parseCitations(answer: string, sourceCount: number): CitationResult {
  const used: number[] = [];
  const dropped: number[] = [];

  const text = answer
    .replace(GROUP, (_m, nums: string) => {
      const kept: number[] = [];
      for (const raw of nums.split(",")) {
        const n = Number(raw.trim());
        if (n >= 1 && n <= sourceCount) {
          kept.push(n);
          if (!used.includes(n)) used.push(n);
        } else {
          dropped.push(n);
        }
      }
      return kept.map((n) => `[${n}]`).join("");
    })
    .replace(/[ \t]+([.,;:!?])/g, "$1") // a removed marker can leave " ."
    .replace(/[ \t]{2,}/g, " ");

  return { text, used, dropped };
}
