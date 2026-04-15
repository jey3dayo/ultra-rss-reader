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
    <div className="space-y-4">
      <div className="text-[0.72rem] font-medium uppercase leading-none tracking-[0.14em] text-muted-foreground/80">
        <p>{publishedLabel}</p>
      </div>
      <h1 className="text-[2rem] font-semibold leading-[1.06] tracking-[-0.04em] text-foreground sm:text-[2.6rem]">
        {onTitleClick ? (
          <button
            type="button"
            className="-mx-1 block w-[calc(100%+0.5rem)] rounded-md px-1 py-0.5 text-left transition-colors hover:bg-foreground/5"
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
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm leading-6 text-muted-foreground/82">
          {feedName &&
            (onFeedClick ? (
              <button
                type="button"
                className="-mx-1 inline-flex items-center rounded-md px-1 py-0.5 text-sm text-muted-foreground/82 transition-colors hover:text-foreground"
                onClick={onFeedClick}
              >
                {feedName}
              </button>
            ) : (
              <span>{feedName}</span>
            ))}
          {feedName && author ? (
            <span aria-hidden="true" className="text-muted-foreground/40">
              /
            </span>
          ) : null}
          {author && <p>{author}</p>}
        </div>
      )}
    </div>
  );
}
