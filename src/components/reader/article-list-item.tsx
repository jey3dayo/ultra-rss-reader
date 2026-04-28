import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { StarIcon, UnreadIcon } from "@/components/shared/article-state-icon";
import { formatArticleTime } from "@/lib/article-list";
import { stripHtmlTags } from "@/lib/html";
import { focusArticleContentTarget } from "@/lib/reader-focus";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import type { ArticleListItemProps } from "./article-list.types";

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
  const isRead = article.is_read || isRecentlyRead;
  const isUnread = !isRead;
  const normalizedTitle = article.title.trim();
  const normalizedFeedName = feedName?.trim() ?? "";
  const summaryText = article.summary ? stripHtmlTags(article.summary) : "";
  const normalizedSummary = summaryText.trim();
  const showFeedName = Boolean(normalizedFeedName) && normalizedFeedName !== normalizedTitle;
  const viewedAtLabel = article.viewed_at ? t("viewed_at", { time: formatArticleTime(article.viewed_at) }) : null;
  const metaLabel = [showFeedName ? normalizedFeedName : null, viewedAtLabel].filter(Boolean).join(" · ");
  const showSummary =
    textPreview === "true" &&
    Boolean(normalizedSummary) &&
    normalizedSummary !== normalizedTitle &&
    normalizedSummary !== normalizedFeedName;
  const showSecondaryRow = showSummary || (imagePreviews !== "off" && article.thumbnail);

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
      aria-label={`${article.title}${isRead ? "" : ` ${t("unread_suffix")}`}${article.is_starred ? ` ${t("starred_suffix")}` : ""}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative isolate flex w-full cursor-pointer flex-col gap-1 rounded-lg px-4 py-3 text-left outline-none transition-[background-color,border-color,box-shadow,color,opacity] duration-150",
        selectionStyle === "classic"
          ? cn(
              "focus-visible:bg-[linear-gradient(90deg,var(--sidebar-hover-surface)_0%,color-mix(in_srgb,var(--sidebar-hover-surface)_58%,transparent)_100%)]",
              isSelected &&
                activePane &&
                "border-l-2 border-primary bg-[linear-gradient(90deg,var(--sidebar-selection-background)_0%,color-mix(in_srgb,var(--sidebar-selection-background)_68%,var(--sidebar-hover-surface))_100%)]",
              isSelected &&
                !activePane &&
                "border-l-2 border-border-strong/60 bg-[linear-gradient(90deg,var(--sidebar-hover-surface)_0%,color-mix(in_srgb,var(--sidebar-hover-surface)_68%,transparent)_100%)]",
            )
          : cn(
              isSelected &&
                cn(
                  activePane
                    ? "bg-[linear-gradient(90deg,var(--sidebar-selection-background)_0%,color-mix(in_srgb,var(--sidebar-selection-background)_68%,var(--sidebar-hover-surface))_100%)] after:bg-border-strong focus-visible:bg-[linear-gradient(90deg,var(--sidebar-selection-background)_0%,color-mix(in_srgb,var(--sidebar-selection-background)_68%,var(--sidebar-hover-surface))_100%)]"
                    : "bg-[linear-gradient(90deg,var(--sidebar-hover-surface)_0%,color-mix(in_srgb,var(--sidebar-hover-surface)_68%,transparent)_100%)] after:bg-border-strong/60 focus-visible:bg-[linear-gradient(90deg,var(--sidebar-hover-surface)_0%,color-mix(in_srgb,var(--sidebar-hover-surface)_68%,transparent)_100%)]",
                  "after:absolute after:inset-y-2 after:left-1.5 after:w-1 after:rounded-full",
                ),
            ),
        !isSelected &&
          "hover:bg-surface-1/72 focus-visible:bg-[linear-gradient(90deg,var(--sidebar-hover-surface)_0%,color-mix(in_srgb,var(--sidebar-hover-surface)_58%,transparent)_100%)]",
        isRead && !isSelected && (isRecentlyRead || dimArchived === "true") && "opacity-50",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex flex-1 items-start gap-2">
          <UnreadIcon unread={isUnread} className={cn("mt-1.5 h-2 w-2", !isUnread && "invisible")} />
          <div className="flex flex-1 items-start gap-1.5">
            <h3
              className={cn(
                "line-clamp-2 flex-1 text-sm leading-snug",
                isSelected
                  ? "font-semibold text-foreground"
                  : isUnread
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

      {metaLabel && (
        <p
          className={cn(
            "pl-4 text-xs text-foreground-soft transition-colors duration-150",
            isSelected && "text-foreground/72",
          )}
        >
          {metaLabel}
        </p>
      )}

      {showSecondaryRow && (
        <div className="flex items-start gap-2 pl-4">
          {showSummary && (
            <p
              className={cn(
                "line-clamp-2 flex-1 text-xs leading-relaxed text-foreground-soft transition-colors duration-150",
                isSelected && "text-foreground/68",
              )}
            >
              {normalizedSummary}
            </p>
          )}
          {imagePreviews !== "off" && article.thumbnail && (
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
