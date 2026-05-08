import type { MouseEventHandler } from "react";
import { ReaderInlineActionButton } from "./reader-inline-action-button";

type ArticleMetaViewProps = {
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
    <div className="space-y-4">
      <div className="font-sans text-[0.8rem] font-medium leading-none tracking-[0.08em] tabular-nums text-foreground-soft">
        <p>{publishedLabel}</p>
      </div>
      <h1 className="font-sans text-[1.66rem] font-normal leading-[1.07] tracking-[-0.04em] text-foreground sm:text-[2.06rem]">
        {onTitleClick ? (
          <ReaderInlineActionButton variant="title" onClick={onTitleClick} onAuxClick={onTitleAuxClick}>
            {title}
          </ReaderInlineActionButton>
        ) : (
          title
        )}
      </h1>
      {(feedName || author) && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-serif text-[0.95rem] leading-[1.7] text-foreground-soft">
          {feedName &&
            (onFeedClick ? (
              <ReaderInlineActionButton variant="feed" onClick={onFeedClick}>
                {feedName}
              </ReaderInlineActionButton>
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
