import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { StarIcon, UnreadIcon } from "@/components/shared/article-state-icon";
import { stripHtmlTags } from "@/lib/html";
import { cn } from "@/lib/utils";
import type { ArticleListItemProps } from "./article-list.types";

export function ArticleListItem({
  article,
  isSelected,
  isRecentlyRead,
  dimArchived,
  textPreview,
  imagePreviews,
  selectionStyle,
  feedName,
  onSelect,
}: ArticleListItemProps) {
  const { t } = useTranslation("reader");
  const isRead = article.is_read || isRecentlyRead;
  const isUnread = !isRead;
  const normalizedTitle = article.title.trim();
  const normalizedFeedName = feedName?.trim() ?? "";
  const summaryText = article.summary ? stripHtmlTags(article.summary) : "";
  const normalizedSummary = summaryText.trim();
  const showFeedName = Boolean(normalizedFeedName) && normalizedFeedName !== normalizedTitle;
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
  };

  return (
    <div
      data-article-id={article.id}
      role="option"
      tabIndex={isSelected ? 0 : -1}
      aria-selected={isSelected}
      aria-label={`${article.title}${isRead ? "" : ` ${t("unread_suffix")}`}${article.is_starred ? ` ${t("starred_suffix")}` : ""}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative flex w-full cursor-pointer flex-col gap-1 px-4 py-3 text-left outline-none transition-[background-color,border-color,box-shadow,color] duration-150",
        selectionStyle === "classic"
          ? cn(
              "focus-visible:bg-surface-1/72 focus-visible:shadow-[inset_0_0_0_1px_var(--color-border-strong)]",
              isSelected && "border-l-2 border-primary bg-surface-1/72",
            )
          : cn(
              isSelected &&
                "bg-surface-1 shadow-[0_18px_34px_-30px_rgba(38,37,30,0.48)] after:absolute after:inset-y-2 after:left-1.5 after:w-1 after:rounded-full after:bg-border-strong",
            ),
        !isSelected && "hover:bg-surface-1/72",
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
                    ? "font-semibold text-foreground"
                    : "text-foreground/78",
              )}
            >
              {article.title}
            </h3>
            {article.is_starred ? (
              <StarIcon starred className="mt-0.5 h-3 w-3 shrink-0" data-testid="article-star-indicator" />
            ) : null}
          </div>
        </div>
      </div>

      {showFeedName && (
        <p className={cn("pl-4 text-xs text-foreground-soft", isSelected && "text-foreground/72")}>
          {normalizedFeedName}
        </p>
      )}

      {showSecondaryRow && (
        <div className="flex items-start gap-2 pl-4">
          {showSummary && (
            <p className="line-clamp-2 flex-1 text-xs leading-relaxed text-foreground-soft">{normalizedSummary}</p>
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
