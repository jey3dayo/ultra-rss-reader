const JAPANESE_TEXT_PATTERN = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;

export function segmentToastMessage(message: string, locale?: string): string[] | null {
  if (typeof Intl.Segmenter !== "function") return null;

  const segmenterLocale = JAPANESE_TEXT_PATTERN.test(message) ? "ja" : locale || undefined;
  const segmenter = new Intl.Segmenter(segmenterLocale, { granularity: "word" });
  return Array.from(segmenter.segment(message), ({ segment }) => segment);
}
