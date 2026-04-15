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
      <div className="flex flex-wrap items-center gap-3.5 text-[0.76rem] font-medium uppercase tracking-[0.14em] text-muted-foreground/90">
        <p>{publishedLabel}</p>
        {feedName &&
          (onFeedClick ? (
            <button
              type="button"
              className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[0.76rem] tracking-[0.14em] text-foreground transition-colors hover:border-primary/30 hover:text-foreground"
              onClick={onFeedClick}
            >
              {feedName}
            </button>
          ) : (
            <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[0.76rem] tracking-[0.14em] text-foreground">
              {feedName}
            </span>
          ))}
      </div>
      <h1 className="text-[1.82rem] font-semibold leading-[1.14] tracking-[-0.03em] text-foreground sm:text-[2.18rem]">
        {onTitleClick ? (
          <button
            type="button"
            className="-mx-3 block w-[calc(100%+1.5rem)] rounded-[1.2rem] px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
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
        <div className="text-[0.8rem] text-muted-foreground/92">
          <p className="uppercase tracking-[0.16em] text-muted-foreground/88">{author}</p>
        </div>
      )}
    </div>
  );
}
