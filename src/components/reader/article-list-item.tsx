import type { ArticleDto } from "@/api/tauri-commands";
import { formatArticleTime } from "@/lib/article-list";
import { cn } from "@/lib/utils";

type ArticleListItemProps = {
  article: ArticleDto;
  isSelected: boolean;
  dimArchived: string;
  textPreview: string;
  imagePreviews: string;
  feedName: string | undefined;
  onSelect: () => void;
};

export function ArticleListItem({
  article,
  isSelected,
  dimArchived,
  textPreview,
  imagePreviews,
  feedName,
  onSelect,
}: ArticleListItemProps) {
  return (
    <button
      type="button"
      data-article-id={article.id}
      role="option"
      aria-selected={isSelected}
      aria-label={`${article.title}${article.is_read ? "" : " (unread)"}${article.is_starred ? " (starred)" : ""}`}
      onClick={onSelect}
      className={cn(
        "relative flex w-full flex-col gap-1 border-l-2 px-4 py-3 text-left transition-colors",
        isSelected
          ? "border-l-accent bg-accent/10"
          : !article.is_read
            ? "border-l-accent/60 hover:bg-muted/50"
            : dimArchived === "true"
              ? "border-l-transparent hover:bg-muted/50 opacity-60"
              : "border-l-transparent hover:bg-muted/50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1">
          <h3 className={cn("line-clamp-2 text-sm leading-snug text-foreground", !article.is_read && "font-medium")}>
            {article.title}
          </h3>
          {feedName && <p className="text-xs text-muted-foreground">{feedName}</p>}
          {textPreview === "true" && article.summary && (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{article.summary}</p>
          )}
        </div>

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

      <div className="absolute right-4 top-3 text-xs text-muted-foreground">
        {formatArticleTime(article.published_at)}
      </div>
    </button>
  );
}
