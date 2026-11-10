const JAPANESE_TEXT_PATTERN = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const Segmenter = Intl.Segmenter;
const defaultWordSegmenter = typeof Segmenter === "function" ? new Segmenter(undefined, { granularity: "word" }) : null;
const japaneseWordSegmenter = typeof Segmenter === "function" ? new Segmenter("ja", { granularity: "word" }) : null;

export function segmentToastMessage(message: string, _locale?: string): string[] | null {
  const segmenter = JAPANESE_TEXT_PATTERN.test(message) ? japaneseWordSegmenter : defaultWordSegmenter;
  if (segmenter === null) return null;

  return Array.from(segmenter.segment(message), ({ segment }) => segment);
}
