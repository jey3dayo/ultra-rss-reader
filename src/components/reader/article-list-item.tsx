import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto } from "@/api/tauri-commands";
import { StarIcon, UnreadIcon } from "@/components/shared/article-state-icon";
import { formatArticleTime } from "@/lib/articles/article-list";
import { stripHtmlTags } from "@/lib/content/html";
import { focusArticleContentTarget } from "@/lib/reader-focus";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

type ArticleListItemProps = {
  article: ArticleDto;
  isSelected: boolean;
  isActivePane?: boolean;
  isRecentlyRead: boolean;
  dimArchived: string;
  textPreview: string;
  imagePreviews: string;
  selectionStyle: string;
  feedName: string | undefined;
  onSelect: () => void;
};

type ArticleListItemPresentationInput = {
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

type ArticleListItemPresentation = {
  ariaLabel: string;
  isRead: boolean;
  isUnread: boolean;
  metaLabel: string;
  normalizedFeedName: string;
  normalizedSummary: string;
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
  const normalizedTitle = title.trim();
  const normalizedFeedName = feedName?.trim() ?? "";
  const summaryText = summary ? stripHtmlTags(summary) : "";
  const normalizedSummary = summaryText.trim();
  const showFeedName = Boolean(normalizedFeedName) && normalizedFeedName !== normalizedTitle;
  const metaLabel = [showFeedName ? normalizedFeedName : null, viewedAtLabel].filter(Boolean).join(" · ");
  const showSummary =
    textPreview === "true" &&
    Boolean(normalizedSummary) &&
    normalizedSummary !== normalizedTitle &&
    normalizedSummary !== normalizedFeedName;
  const showThumbnail = imagePreviews !== "off" && Boolean(thumbnail);

  return {
    ariaLabel: `${title}${isRead ? "" : ` ${unreadSuffix}`}${isStarred ? ` ${starredSuffix}` : ""}`,
    isRead,
    isUnread,
    metaLabel,
    normalizedFeedName,
    normalizedSummary,
    normalizedTitle,
    showFeedName,
    showSecondaryRow: showSummary || showThumbnail,
    showSummary,
    showThumbnail,
  };
}

export function ArticleListItem({
  article,
  isSelected,
  isActivePane,
  isRecentlyRead,
  dimArchived,
  textPreview,
  imagePreviews,
  selectionStyle,
  feedName,
  onSelect,
}: ArticleListItemProps) {
  const { t } = useTranslation("reader");
  const focusedPane = useUiStore((state) => state.focusedPane);
  const activePane = isActivePane ?? focusedPane === "list";
  const viewedAtLabel = article.viewed_at ? t("viewed_at", { time: formatArticleTime(article.viewed_at) }) : null;
  const presentation = resolveArticleListItemPresentation({
    title: article.title,
    summary: article.summary,
    thumbnail: article.thumbnail,
    feedName,
    viewedAtLabel,
    isRead: article.is_read,
    isStarred: article.is_starred,
    isRecentlyRead,
    textPreview,
    imagePreviews,
    unreadSuffix: t("unread_suffix"),
    starredSuffix: t("starred_suffix"),
  });

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onSelect();
    requestAnimationFrame(() => {
      focusArticleContentTarget();
    });
  };

  return (
    <div
      data-article-id={article.id}
      role="option"
      tabIndex={isSelected ? 0 : -1}
      aria-selected={isSelected}
      data-active-pane={isSelected ? String(activePane) : undefined}
      aria-label={presentation.ariaLabel}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative isolate flex w-full cursor-pointer flex-col gap-1 rounded-md px-4 py-3 text-left outline-none transition-[background-color,border-color,box-shadow,color,opacity] duration-150 motion-reduce:transition-none",
        selectionStyle === "classic"
          ? cn(
              "focus-visible:bg-[image:var(--sidebar-focus-gradient)]",
              isSelected && activePane && "border-l-2 border-primary bg-[image:var(--sidebar-selection-gradient)]",
              isSelected &&
                !activePane &&
                "border-l-2 border-border-strong/60 bg-[image:var(--sidebar-hover-gradient)]",
            )
          : cn(
              isSelected &&
                cn(
                  activePane
                    ? "bg-[image:var(--sidebar-selection-gradient)] after:bg-border-strong focus-visible:bg-[image:var(--sidebar-selection-gradient)]"
                    : "bg-[image:var(--sidebar-hover-gradient)] after:bg-border-strong/60 focus-visible:bg-[image:var(--sidebar-hover-gradient)]",
                  "after:absolute after:inset-y-1.5 after:left-1 after:w-1 after:rounded-sm",
                ),
            ),
        !isSelected && "hover:bg-surface-1/72 focus-visible:bg-[image:var(--sidebar-focus-gradient)]",
        presentation.isRead && !isSelected && (isRecentlyRead || dimArchived === "true") && "opacity-50",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex flex-1 items-start gap-2">
          <UnreadIcon
            unread={presentation.isUnread}
            className={cn("mt-1.5 h-2 w-2", !presentation.isUnread && "invisible")}
          />
          <div className="flex flex-1 items-start gap-1.5">
            <h3
              className={cn(
                "line-clamp-2 flex-1 text-sm leading-snug",
                isSelected
                  ? "font-semibold text-foreground"
                  : presentation.isUnread
                    ? "font-medium text-foreground/92"
                    : "text-foreground/78",
              )}
            >
              {article.title}
            </h3>
            <span
              aria-hidden={!article.is_starred}
              data-testid="article-star-slot"
              className="mt-0.5 flex h-3 w-3 shrink-0 items-center justify-center"
            >
              {article.is_starred ? (
                <StarIcon starred className="h-3 w-3" data-testid="article-star-indicator" />
              ) : null}
            </span>
          </div>
        </div>
      </div>

      {presentation.metaLabel && (
        <p
          className={cn(
            "pl-4 text-xs text-foreground-soft transition-colors duration-150 motion-reduce:transition-none",
            isSelected && "text-foreground/72",
          )}
        >
          {presentation.metaLabel}
        </p>
      )}

      {presentation.showSecondaryRow && (
        <div className="flex items-start gap-2 pl-4">
          {presentation.showSummary && (
            <p
              className={cn(
                "line-clamp-2 flex-1 text-xs leading-relaxed text-foreground-soft transition-colors duration-150 motion-reduce:transition-none",
                isSelected && "text-foreground/68",
              )}
            >
              {presentation.normalizedSummary}
            </p>
          )}
          {presentation.showThumbnail && article.thumbnail && (
            <div
              className={cn(
                "relative shrink-0 overflow-hidden rounded",
                imagePreviews === "small" && "h-12 w-16",
                imagePreviews === "medium" && "h-16 w-20",
                imagePreviews === "large" && "h-20 w-28",
              )}
            >
              <img src={article.thumbnail} alt="" className="h-full w-full object-cover" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
