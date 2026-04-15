import type { ArticleMetaViewProps } from "./article-view.types";

export function ArticleMetaView({
  title,
  author,
  feedName,
  publishedLabel,
  onTitleClick,
  onTitleAuxClick,
  onFeedClick,
}: ArticleMetaViewProps) {
  return (
    <div className="space-y-5">
      <div className="text-[0.72rem] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
        <p>{publishedLabel}</p>
      </div>
      <h1 className="text-[2rem] font-semibold leading-[1.06] tracking-[-0.04em] text-foreground sm:text-[2.6rem]">
        {onTitleClick ? (
          <button
            type="button"
            className="-mx-1 rounded-md px-1 py-1 text-left transition-colors hover:bg-foreground/5"
            onClick={onTitleClick}
            onAuxClick={onTitleAuxClick}
          >
            {title}
          </button>
        ) : (
          title
        )}
      </h1>
      {(feedName || author) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {feedName &&
            (onFeedClick ? (
              <button
                type="button"
                className="-mx-1 rounded-md px-1 py-0.5 text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                onClick={onFeedClick}
              >
                {feedName}
              </button>
            ) : (
              <span>{feedName}</span>
            ))}
          {author && <p>{author}</p>}
        </div>
      )}
    </div>
  );
}
