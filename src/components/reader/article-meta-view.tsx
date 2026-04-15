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
      <div className="flex flex-wrap items-center gap-3 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <p>{publishedLabel}</p>
        {feedName &&
          (onFeedClick ? (
            <button
              type="button"
              className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[0.68rem] tracking-[0.18em] text-foreground transition-colors hover:border-primary/30 hover:text-foreground"
              onClick={onFeedClick}
            >
              {feedName}
            </button>
          ) : (
            <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[0.68rem] tracking-[0.18em] text-foreground">
              {feedName}
            </span>
          ))}
      </div>
      <h1 className="text-[2.35rem] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground sm:text-[2.85rem]">
        {onTitleClick ? (
          <button
            type="button"
            className="-mx-4 block w-[calc(100%+2rem)] rounded-[1.4rem] px-4 py-3 text-left transition-colors hover:bg-muted/40"
            onClick={onTitleClick}
            onAuxClick={onTitleAuxClick}
          >
            {title}
          </button>
        ) : (
          title
        )}
      </h1>
      {author && (
        <div className="text-sm text-muted-foreground">
          <p className="uppercase tracking-[0.22em] text-muted-foreground/80">{author}</p>
        </div>
      )}
    </div>
  );
}
