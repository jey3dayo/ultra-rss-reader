/**
 * Shared mock-article helpers and seed-state contract used by both the
 * default Japanese dev fixtures (`mock-data.ts`) and the English demo
 * fixtures (`mock-data-demo-en.ts`). Kept locale-agnostic so neither seed
 * set has to duplicate the `ArticleDto` construction helper.
 */

import type { AccountDto, ArticleDto, FeedDto, FolderDto, TagDto } from "@/api/tauri-commands";
import { createLocalDateTime, toIsoTimestamp } from "@/lib/datetime";

export function mockArticlePublishedAt(baseDate: Date, hours: number, minutes: number): string {
  return toIsoTimestamp(createLocalDateTime(baseDate, hours, minutes));
}

export type MockArticleTag = { article_id: string; tag_id: string };

export type MockArticleSeed = {
  id: string;
  feedId: string;
  title: string;
  summary: string;
  url: string;
  author: string | null;
  date: Date;
  hours: number;
  minutes: number;
  contentHtml?: string;
  thumbnail?: string | null;
  isRead?: boolean;
  isStarred?: boolean;
};

/**
 * Fallback sentence appended to `content_sanitized` when a seed omits
 * `contentHtml`. Kept as an explicit parameter (default: the existing
 * Japanese wording) so the `mock-data-demo-en.ts` seed set can supply an
 * English equivalent instead of leaking Japanese copy into English-locale
 * dev screenshots. Do not change the default — it is the ja fixture's
 * existing wording, relied on by ja screenshots and tests.
 */
const DEFAULT_MOCK_ARTICLE_FALLBACK_NOTE_JA =
  "キーボード操作とスクロール量を確認しやすいように用意したブラウザ開発用のサンプル記事です。";

export function createMockArticle(
  seed: MockArticleSeed,
  fallbackNote: string = DEFAULT_MOCK_ARTICLE_FALLBACK_NOTE_JA,
): ArticleDto {
  return {
    id: seed.id,
    feed_id: seed.feedId,
    title: seed.title,
    content_sanitized: seed.contentHtml ?? `<p>${seed.summary}</p><p>${fallbackNote}</p>`,
    summary: seed.summary,
    url: seed.url,
    author: seed.author,
    published_at: mockArticlePublishedAt(seed.date, seed.hours, seed.minutes),
    thumbnail: seed.thumbnail ?? null,
    is_read: seed.isRead ?? false,
    is_starred: seed.isStarred ?? false,
  };
}

export type RelativeMockArticlePublishedAtMap = Record<string, { dayOffset: number; hours: number; minutes: number }>;

export type DevMockSeedState = {
  readonly accounts: readonly AccountDto[];
  readonly folders: readonly FolderDto[];
  readonly feeds: readonly FeedDto[];
  readonly tags: readonly TagDto[];
  readonly articleTags: readonly MockArticleTag[];
  readonly articles: readonly ArticleDto[];
};
