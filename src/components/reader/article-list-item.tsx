import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto } from "@/api/tauri-commands";
import { StarIcon, UnreadIcon } from "@/components/shared/article-state-icon";
import { formatArticleTime } from "@/lib/article-list";
import { stripHtmlTags } from "@/lib/html";
import { cn } from "@/lib/utils";

type ArticleListItemProps = {
  article: ArticleDto;
  isSelected: boolean;
  isRecentlyRead: boolean;
  dimArchived: string;
  textPreview: string;
  imagePreviews: string;
  selectionStyle: string;
  feedName: string | undefined;
  onSelect: () => void;
};

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
        "flex w-full cursor-pointer flex-col gap-1 px-4 py-3 text-left outline-none transition-colors",
        selectionStyle === "classic"
          ? cn(isSelected && "border-l-2 border-primary bg-primary/10")
          : cn(isSelected && "bg-muted"),
        !isSelected && "hover:bg-muted/50",
        isRead && !isSelected && (isRecentlyRead || dimArchived === "true") && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-1 items-start gap-2">
          <UnreadIcon unread={isUnread} className={cn("mt-1.5 h-2 w-2", !isUnread && "invisible")} />
          <div className="flex flex-1 items-start gap-1.5">
            <h3
              className={cn(
                "line-clamp-2 flex-1 text-sm leading-snug",
                isUnread ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {article.title}
            </h3>
            {article.is_starred ? (
              <StarIcon
                starred
                className="mt-0.5 h-3 w-3 shrink-0 text-yellow-400/90"
                data-testid="article-star-indicator"
              />
            ) : null}
          </div>
        </div>
        <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">{formatArticleTime(article.published_at)}</span>
      </div>

      {feedName && (
        <p className={cn("pl-4 text-xs", isUnread ? "text-muted-foreground" : "text-muted-foreground/70")}>
          {feedName}
        </p>
      )}

      <div className="flex items-start gap-2 pl-4">
        {textPreview === "true" && article.summary && (
          <p
            className={cn(
              "line-clamp-2 flex-1 text-xs leading-relaxed",
              isUnread ? "text-muted-foreground" : "text-muted-foreground/70",
            )}
          >
            {stripHtmlTags(article.summary)}
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
    </div>
  );
}
