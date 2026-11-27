import type { MouseEventHandler } from "react";
import { useTranslation } from "react-i18next";
import { normalizeArticleDisplayTitle } from "@/lib/articles/article-list-item-presentation";
import { FeedSiteLink } from "./feed-site-link";
import { ReaderInlineActionButton } from "./reader-inline-action-button";

type ArticleMetaSiteLink = {
  href: string;
  label: string;
  title: string;
  onOpen: (href: string, options: { external: boolean }) => void;
};

type ArticleMetaViewProps = {
  title: string;
  author?: string | null;
  feedName?: string | null;
  publishedLabel: string;
  siteLink?: ArticleMetaSiteLink | null;
  onTitleClick?: MouseEventHandler<HTMLButtonElement>;
  onTitleAuxClick?: MouseEventHandler<HTMLButtonElement>;
  onShowFeed?: () => void;
};

export function ArticleMetaView({
  title,
  author,
  feedName,
  publishedLabel,
  siteLink,
  onTitleClick,
  onTitleAuxClick,
  onShowFeed,
}: ArticleMetaViewProps) {
  const { t } = useTranslation("reader");
  const displayTitle = normalizeArticleDisplayTitle(title, t("article_untitled_fallback"));
  const normalizedAuthor = author?.trim() ?? "";
  const normalizedFeedName = feedName?.trim() ?? "";

  return (
    <div className="space-y-4">
      <div className="font-sans text-[0.8rem] font-medium leading-none tracking-[0.02em] tabular-nums text-foreground-soft">
        <p>{publishedLabel}</p>
      </div>
      <h1 className="font-sans text-[1.66rem] font-normal leading-[1.07] tracking-[-0.04em] text-foreground sm:text-[2.06rem]">
        {onTitleClick ? (
          <ReaderInlineActionButton variant="title" onClick={onTitleClick} onAuxClick={onTitleAuxClick}>
            {displayTitle}
          </ReaderInlineActionButton>
        ) : (
          displayTitle
        )}
      </h1>
      {(normalizedFeedName || siteLink || normalizedAuthor) && (
        <div className="flex flex-wrap items-baseline justify-start gap-x-2.5 gap-y-1 text-left text-[0.95rem] leading-[1.7] text-foreground-soft">
          <ArticleMetaFeedName feedName={normalizedFeedName} siteLink={siteLink} />
          <ArticleMetaDomainAction feedName={normalizedFeedName} siteLink={siteLink} onShowFeed={onShowFeed} />
          {normalizedAuthor ? (
            <span className="inline-flex max-w-full min-w-0 items-baseline gap-x-2.5 whitespace-nowrap">
              {normalizedFeedName || siteLink ? <MetaSeparator /> : null}
              <span className="truncate" title={normalizedAuthor}>
                {normalizedAuthor}
              </span>
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

type ArticleMetaFeedPartProps = {
  feedName: string;
  siteLink?: ArticleMetaSiteLink | null;
};

function ArticleMetaFeedName({ feedName, siteLink }: ArticleMetaFeedPartProps) {
  if (!feedName) {
    return null;
  }

  if (!siteLink) {
    return (
      <span className="min-w-0 max-w-full truncate" dir="auto" title={feedName}>
        {feedName}
      </span>
    );
  }

  return (
    <FeedSiteLink
      href={siteLink.href}
      title={feedName}
      onOpen={siteLink.onOpen}
      dir="auto"
      className="inline-block min-w-0 max-w-full truncate"
    >
      {feedName}
    </FeedSiteLink>
  );
}

function ArticleMetaDomainAction({
  feedName,
  siteLink,
  onShowFeed,
}: ArticleMetaFeedPartProps & { onShowFeed?: () => void }) {
  const { t } = useTranslation("reader");

  if (feedName && onShowFeed) {
    return (
      <>
        <MetaSeparator />
        <ReaderInlineActionButton
          variant="feed"
          onClick={onShowFeed}
          className="inline-block min-w-0 max-w-full text-left [overflow-wrap:anywhere]"
          title={t("article_meta_show_feed_title", { feedName })}
        >
          {siteLink ? `${siteLink.label} · ` : null}
          <span className="whitespace-nowrap">{t("article_meta_show_feed")}</span>
        </ReaderInlineActionButton>
      </>
    );
  }

  if (!siteLink) {
    return null;
  }

  return (
    <>
      {feedName ? <MetaSeparator /> : null}
      <FeedSiteLink
        href={siteLink.href}
        title={siteLink.title}
        onOpen={siteLink.onOpen}
        icon
        className="inline-flex items-center gap-1"
      >
        {siteLink.label}
      </FeedSiteLink>
    </>
  );
}

function MetaSeparator() {
  return (
    <span aria-hidden="true" className="text-[var(--reader-context-border)]">
      /
    </span>
  );
}
