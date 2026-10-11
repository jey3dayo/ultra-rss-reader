import { Globe } from "lucide-react";
import type { MouseEvent, MouseEventHandler } from "react";
import { ReaderInlineActionButton } from "./reader-inline-action-button";

type ArticleMetaSiteLink = {
  href: string;
  label: string;
  title: string;
  onOpen: (href: string) => void;
};

type ArticleMetaViewProps = {
  title: string;
  author?: string | null;
  feedName?: string | null;
  publishedLabel: string;
  siteLink?: ArticleMetaSiteLink | null;
  onTitleClick?: MouseEventHandler<HTMLButtonElement>;
  onTitleAuxClick?: MouseEventHandler<HTMLButtonElement>;
  onFeedClick?: () => void;
};

export function ArticleMetaView({
  title,
  author,
  feedName,
  publishedLabel,
  siteLink,
  onTitleClick,
  onTitleAuxClick,
  onFeedClick,
}: ArticleMetaViewProps) {
  function handleSiteClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    siteLink?.onOpen(siteLink.href);
  }

  function handleSiteAuxClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 1) {
      return;
    }
    event.preventDefault();
    siteLink?.onOpen(siteLink.href);
  }

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
      {(feedName || siteLink || author) && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-serif text-[0.95rem] leading-[1.7] text-foreground-soft">
          {feedName &&
            (onFeedClick ? (
              <ReaderInlineActionButton variant="feed" onClick={onFeedClick}>
                {feedName}
              </ReaderInlineActionButton>
            ) : (
              <span>{feedName}</span>
            ))}
          {feedName && siteLink ? <MetaSeparator /> : null}
          {siteLink ? (
            <a
              href={siteLink.href}
              title={siteLink.title}
              onClick={handleSiteClick}
              onAuxClick={handleSiteAuxClick}
              className="inline-flex items-center gap-1 underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
            >
              <Globe aria-hidden="true" className="size-3.5 shrink-0" />
              {siteLink.label}
            </a>
          ) : null}
          {(feedName || siteLink) && author ? <MetaSeparator /> : null}
          {author && <p>{author}</p>}
        </div>
      )}
    </div>
  );
}

function MetaSeparator() {
  return (
    <span aria-hidden="true" className="text-[var(--reader-context-border)]">
      /
    </span>
  );
}
