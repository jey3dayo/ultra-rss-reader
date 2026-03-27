/**
 * Bionic Reading: bolds the initial portion of each word in HTML content
 * to guide the eye and improve reading speed.
 *
 * @param html - sanitized HTML string
 * @param fixation - 1-5, how much of each word to bold (1=minimal, 5=most)
 */
export function applyBionicReading(html: string, fixation: number): string {
  const level = Math.max(1, Math.min(5, fixation));

  // Split on HTML tags, process only text segments
  return html.replace(/(<[^>]*>)|([^<]+)/g, (match, tag: string | undefined, text: string | undefined) => {
    if (tag) return tag; // preserve HTML tags as-is
    if (!text) return match;

    return text.replace(/\b(\p{L}[\p{L}''\u2019-]*)/gu, (word: string) => {
      if (word.length <= 1) return `<b>${word}</b>`;
      const boldLen = getBoldLength(word.length, level);
      return `<b>${word.slice(0, boldLen)}</b>${word.slice(boldLen)}`;
    });
  });
}

function getBoldLength(wordLength: number, level: number): number {
  const ratios = [0.25, 0.35, 0.5, 0.65, 0.8];
  const ratio = ratios[level - 1];
  return Math.max(1, Math.ceil(wordLength * ratio));
}
