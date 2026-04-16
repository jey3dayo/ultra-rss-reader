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
    <div className="space-y-3">
      <div className="font-sans text-[0.8rem] font-medium uppercase leading-none tracking-[0.14em] text-foreground-soft">
        <p>{publishedLabel}</p>
      </div>
      <h1 className="font-sans text-[1.66rem] font-normal leading-[1.07] tracking-[-0.04em] text-foreground sm:text-[2.06rem]">
        {onTitleClick ? (
          <button
            type="button"
            className="-mx-1 -my-1 block w-[calc(100%+0.5rem)] rounded-md px-1 py-1.5 text-left transition-colors hover:bg-surface-1/72"
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
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-serif text-[0.95rem] leading-6 text-foreground-soft">
          {feedName &&
            (onFeedClick ? (
              <button
                type="button"
                className="-mx-1 inline-flex items-center rounded-md px-1 py-0.5 text-[0.95rem] text-foreground-soft transition-colors hover:bg-surface-1/72 hover:text-foreground"
                onClick={onFeedClick}
              >
                {feedName}
              </button>
            ) : (
              <span>{feedName}</span>
            ))}
          {feedName && author ? (
            <span aria-hidden="true" className="text-[var(--reader-context-border)]">
              /
            </span>
          ) : null}
          {author && <p>{author}</p>}
        </div>
      )}
    </div>
  );
}
