import { normalizeArticleRemoteImageUrl } from "@/lib/articles/article-view";
import { stripHtmlTags } from "@/lib/content/html";

const ARTICLE_LIST_ITEM_TITLE_FALLBACK = "Untitled article";
const ARTICLE_LIST_ITEM_TITLE_WHITESPACE_PATTERN = /\s+/g;

// Bulletin-board style feeds (e.g. 2ch/5ch mirrors) often prefix each post
// with a numbered header like `1 名前：Anonymous@2026/07/21(火) ID:xxxxYYYY`,
// which reads as noise once stripped of HTML and shown as a list preview.
const BOARD_POST_HEADER_PATTERN = /^\s*\d+\s*名前[:：].*?(?:ID[:：]\s*[\w./+-]+|(?=$))\s*/u;
// Trailing/standalone response-id fragments such as `ID:xxxxYYYY.net` that
// remain after the leading board header is removed (or never had one).
const RESPONSE_ID_FRAGMENT_PATTERN = /\bID[:：]\s*[\w./+-]+/gu;
// Bare URLs left over in plain-text summaries add no preview value and are
// visually noisy compared to the article's own metadata line.
const BARE_URL_FRAGMENT_PATTERN = /\bhttps?:\/\/\S+/gu;

function stripArticlePreviewNoise(summary: string): string {
  return summary
    .replace(BOARD_POST_HEADER_PATTERN, "")
    .replace(BARE_URL_FRAGMENT_PATTERN, "")
    .replace(RESPONSE_ID_FRAGMENT_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type ArticleListItemPresentationInput = {
  title: string;
  summary?: string | null;
  thumbnail?: string | null;
  feedName?: string;
  viewedAtLabel?: string | null;
  isRead: boolean;
  isStarred: boolean;
  isRecentlyRead: boolean;
  textPreview: string;
  imagePreviews: string;
  unreadSuffix: string;
  starredSuffix: string;
};

export type ArticleListItemPresentation = {
  ariaLabel: string;
  isRead: boolean;
  isUnread: boolean;
  metaLabel: string;
  normalizedFeedName: string;
  normalizedSummary: string;
  normalizedThumbnail: string;
  normalizedTitle: string;
  showFeedName: boolean;
  showSecondaryRow: boolean;
  showSummary: boolean;
  showThumbnail: boolean;
};

export function resolveArticleListItemPresentation({
  title,
  summary,
  thumbnail,
  feedName,
  viewedAtLabel,
  isRead: articleIsRead,
  isStarred,
  isRecentlyRead,
  textPreview,
  imagePreviews,
  unreadSuffix,
  starredSuffix,
}: ArticleListItemPresentationInput): ArticleListItemPresentation {
  const isRead = articleIsRead || isRecentlyRead;
  const isUnread = !isRead;
  const normalizedTitle =
    title.replace(ARTICLE_LIST_ITEM_TITLE_WHITESPACE_PATTERN, " ").trim() || ARTICLE_LIST_ITEM_TITLE_FALLBACK;
  const normalizedFeedName = feedName?.trim() ?? "";
  const normalizedThumbnail = normalizeArticleRemoteImageUrl(thumbnail) ?? "";
  const summaryText = summary ? stripHtmlTags(summary) : "";
  const normalizedSummary = stripArticlePreviewNoise(summaryText);
  const showFeedName = Boolean(normalizedFeedName) && normalizedFeedName !== normalizedTitle;
  const metaLabel = [showFeedName ? normalizedFeedName : null, viewedAtLabel].filter(Boolean).join(" · ");
  const showSummary =
    textPreview === "true" &&
    Boolean(normalizedSummary) &&
    normalizedSummary !== normalizedTitle &&
    normalizedSummary !== normalizedFeedName;
  const showThumbnail = imagePreviews !== "off" && Boolean(normalizedThumbnail);

  return {
    ariaLabel: `${normalizedTitle}${isRead ? "" : ` ${unreadSuffix}`}${isStarred ? ` ${starredSuffix}` : ""}`,
    isRead,
    isUnread,
    metaLabel,
    normalizedFeedName,
    normalizedSummary,
    normalizedThumbnail,
    normalizedTitle,
    showFeedName,
    showSecondaryRow: showSummary || showThumbnail,
    showSummary,
    showThumbnail,
  };
}
