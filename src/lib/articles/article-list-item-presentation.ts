import { normalizeArticleRemoteImageUrl } from "@/lib/articles/article-view";
import { stripHtmlTags } from "@/lib/content/html";

const ARTICLE_LIST_ITEM_TITLE_FALLBACK = "Untitled article";
const ARTICLE_LIST_ITEM_TITLE_WHITESPACE_PATTERN = /\s+/g;

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
  const normalizedSummary = summaryText.trim();
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
