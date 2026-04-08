import type { MouseEventHandler } from "react";

export type ArticleMetaViewProps = {
  title: string;
  author?: string | null;
  feedName?: string | null;
  publishedLabel: string;
  onTitleClick?: MouseEventHandler<HTMLButtonElement>;
  onTitleAuxClick?: MouseEventHandler<HTMLButtonElement>;
  onFeedClick?: () => void;
};

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
    <div className="mb-6">
      <p className="mb-3 text-xs tracking-[0.18em] text-muted-foreground">{publishedLabel}</p>
      <h1 className="mb-3 text-2xl font-bold leading-tight text-foreground">
        {onTitleClick ? (
          <button
            type="button"
            className="-mx-4 block w-[calc(100%+2rem)] rounded-lg px-4 py-3 text-left transition-colors hover:bg-muted/50"
            onClick={onTitleClick}
            onAuxClick={onTitleAuxClick}
          >
            {title}
          </button>
        ) : (
          title
        )}
      </h1>
      {(author || feedName) && (
        <div className="text-sm text-muted-foreground">
          {author && <p className="uppercase tracking-wide">{author}</p>}
          {feedName && onFeedClick && (
            <button type="button" className="cursor-pointer text-xs hover:underline" onClick={onFeedClick}>
              {feedName}
            </button>
          )}
          {feedName && !onFeedClick && <p className="text-xs">{feedName}</p>}
        </div>
      )}
    </div>
  );
}
