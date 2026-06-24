import { FolderClosed, Inbox, Star, Tag as TagIcon } from "lucide-react";
import { type ComponentProps, lazy, type ReactNode, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useArticleViewSelection } from "@/components/reader/hooks/article/use-article-view-selection";
import { useArticleViewUiState } from "@/components/reader/hooks/article/use-article-view-ui-state";
import { FeedDetailPanel, FeedFavicon, MotionNumber } from "@/design-system";
import {
  type ArticleViewSummaryState,
  formatArticleSummaryDate,
  resolveArticleDateLocale,
  resolveArticleSummaryWebsiteHref,
  resolveArticleSummaryWebsiteLabel,
} from "@/lib/articles/article-view";
import i18n from "@/lib/i18n";
import { useI18nResourceNamespace } from "@/lib/i18n/use-i18n-resource-namespace";
import { loadI18nResourceNamespace } from "@/lib/i18n-resources";
import { useUiStore } from "@/stores/ui-store";
import { ArticleEmptyStateView } from "./article-empty-state-view";
import { ArticlePane, ArticleToolbar } from "./article-pane-view";
import { ArticleEmptyStateShell, ArticleNotFoundStateView, BrowserOnlyStateView } from "./article-view-state";
import { readerPassiveCardClassName, readerPassiveCardOffsetClassName } from "./reader-passive-card";

const LazySubscriptionsIndexPage = lazy(async () => {
  await loadI18nResourceNamespace(i18n, "subscriptions");
  const mod = await import("../subscriptions-index/subscriptions-index-page");
  return { default: mod.SubscriptionsIndexPage };
});

export { ArticlePane, ArticleToolbar } from "./article-pane-view";

const SUMMARY_CONTAINER_CLASS_NAME = `w-full max-w-[42rem] ${readerPassiveCardOffsetClassName}`;

type ArticleEmptyStateViewProps = ComponentProps<typeof ArticleEmptyStateView>;

type SummaryCardProps = {
  title: string;
  titleHref?: string | null;
  leadingVisual?: ReactNode;
  summaryText?: string;
  metrics: Array<{ label: string; value: ReactNode }>;
  primaryAction?: ComponentProps<typeof FeedDetailPanel>["primaryAction"];
};

function renderSummaryCount(value: number, locale: string) {
  const label = value.toLocaleString(locale);

  return <MotionNumber key={label} value={label} />;
}

function SummaryEmptyState({
  title,
  titleHref = null,
  leadingVisual,
  summaryText,
  metrics,
  primaryAction,
}: SummaryCardProps) {
  const { t } = useTranslation("reader");

  return (
    <ArticleEmptyStateShell
      toolbar={
        <ArticleToolbar article={null} isBrowserOpen={false} onCloseView={() => {}} onToggleBrowserOverlay={() => {}} />
      }
      body={
        <div className="flex flex-1 items-center justify-center overflow-hidden px-6 pt-6 pb-12">
          <div data-testid="article-selection-summary" className={SUMMARY_CONTAINER_CLASS_NAME}>
            <FeedDetailPanel
              className={readerPassiveCardClassName}
              title={title}
              titleHref={titleHref}
              leadingVisual={leadingVisual}
              summaryText={summaryText}
              metrics={metrics}
              links={[]}
              recentArticlesHeading={t("latest_article")}
              recentArticles={[]}
              primaryAction={primaryAction}
            />
          </div>
        </div>
      }
    />
  );
}

function buildSummaryCardProps(
  summary: ArticleViewSummaryState,
  locale: string,
  readerT: ReturnType<typeof useTranslation<"reader">>["t"],
  sidebarT: ReturnType<typeof useTranslation<"sidebar">>["t"],
): SummaryCardProps {
  if (summary.kind === "feed") {
    const websiteHref = resolveArticleSummaryWebsiteHref(summary.feed);
    const websiteLabel = resolveArticleSummaryWebsiteLabel(summary.feed);

    return {
      title: summary.feed.title,
      titleHref: websiteHref,
      leadingVisual: (
        <FeedFavicon title={summary.feed.title} url={summary.feed.url} siteUrl={summary.feed.site_url} size="lg" />
      ),
      metrics: [
        {
          label: readerT("latest_article"),
          value: (
            <span className="block max-w-[24rem] truncate" title={summary.latestArticleTitle ?? undefined}>
              {summary.latestArticleTitle ?? "—"}
            </span>
          ),
        },
        {
          label: readerT("latest_update"),
          value: formatArticleSummaryDate(summary.latestArticlePublishedAt, locale),
        },
        {
          label: readerT("website_url"),
          value:
            websiteHref && websiteLabel ? (
              <span className="block max-w-[24rem] truncate text-foreground-soft" title={websiteHref} translate="no">
                {websiteLabel}
              </span>
            ) : (
              "—"
            ),
        },
      ],
    };
  }

  if (summary.kind === "folder") {
    return {
      title: summary.folder.name,
      leadingVisual: <FolderClosed className="size-5 text-foreground-soft" />,
      metrics: [
        { label: sidebarT("feeds"), value: renderSummaryCount(summary.feedCount, locale) },
        { label: readerT("unread"), value: renderSummaryCount(summary.unreadCount, locale) },
        { label: readerT("latest_update"), value: formatArticleSummaryDate(summary.latestArticlePublishedAt, locale) },
      ],
    };
  }

  if (summary.kind === "tag") {
    return {
      title: summary.tag.name,
      leadingVisual: summary.tag.color ? (
        <span className="inline-block size-3 rounded-full" style={{ backgroundColor: summary.tag.color }} />
      ) : (
        <TagIcon className="size-5 text-foreground-soft" />
      ),
      metrics: [
        { label: readerT("articles"), value: renderSummaryCount(summary.articleCount, locale) },
        { label: sidebarT("feeds"), value: renderSummaryCount(summary.feedCount, locale) },
        { label: readerT("latest_update"), value: formatArticleSummaryDate(summary.latestArticlePublishedAt, locale) },
      ],
    };
  }

  return {
    title: summary.smartKind === "unread" ? sidebarT("unread") : sidebarT("starred"),
    leadingVisual:
      summary.smartKind === "unread" ? (
        <Inbox className="size-5 text-foreground-soft" />
      ) : (
        <Star className="size-5 text-foreground-soft" />
      ),
    metrics: [
      { label: readerT("articles"), value: renderSummaryCount(summary.articleCount, locale) },
      { label: sidebarT("feeds"), value: renderSummaryCount(summary.feedCount, locale) },
      { label: readerT("latest_update"), value: formatArticleSummaryDate(summary.latestArticlePublishedAt, locale) },
    ],
  };
}

function SelectionSummaryEmptyState({ summary }: { summary: ArticleViewSummaryState }) {
  const { t } = useTranslation("reader");
  const { t: sidebarT } = useTranslation("sidebar");
  const { i18n } = useTranslation("reader");
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const openSubscriptionsIndex = useUiStore((state) => state.openSubscriptionsIndex);
  const locale = resolveArticleDateLocale(i18n.language);
  const cardProps = buildSummaryCardProps(summary, locale, t, sidebarT);
  const primaryAction =
    summary.kind === "feed" && selectedAccountId !== null
      ? {
          label: t("manage_subscription"),
          ariaLabel: t("manage_subscription_aria", { title: summary.feed.title }),
          onClick: () => {
            openSubscriptionsIndex({
              accountId: selectedAccountId,
              activeSummaryFilter: "all",
              selectedFeedId: summary.feed.id,
              expandedGroups: {},
              listScrollTop: {
                scrollTop: 0,
                layoutGeneration: "reader-feed-detail-manage-link",
                viewportHeight: 0,
              },
              keptFeedIds: [],
              deferredFeedIds: [],
            });
          },
        }
      : undefined;

  return (
    <SummaryEmptyState {...cardProps} summaryText={t("empty_state_pick_from_list")} primaryAction={primaryAction} />
  );
}

function EmptyState({
  emptyReason,
  summary,
}: {
  emptyReason: "default" | "no-accounts" | "no-feeds";
  summary?: ArticleViewSummaryState;
}) {
  const { t } = useTranslation("reader");
  const { t: settingsT } = useTranslation("settings");
  const settingsNamespaceReady = useI18nResourceNamespace(emptyReason === "no-accounts" ? "settings" : null);
  const openSettingsAddAccount = useUiStore((state) => state.openSettingsAddAccount);
  const openAddFeedDialog = useUiStore((state) => state.openAddFeedDialog);

  const openAddAccountSettings = () => {
    openSettingsAddAccount();
  };

  if (emptyReason === "default" && summary) {
    return <SelectionSummaryEmptyState summary={summary} />;
  }

  if (emptyReason === "no-accounts" && !settingsNamespaceReady) {
    return null;
  }

  const content: ArticleEmptyStateViewProps =
    emptyReason === "no-accounts"
      ? {
          eyebrow: t("empty_state_no_accounts_eyebrow"),
          message: t("empty_state_no_accounts_title"),
          description: t("empty_state_no_accounts_description"),
          hints: [],
          containerClassName: undefined,
          cardClassName: undefined,
          actions: [{ label: settingsT("add_account_ellipsis"), onClick: openAddAccountSettings, variant: "default" }],
        }
      : emptyReason === "no-feeds"
        ? {
            eyebrow: t("empty_state_no_feeds_eyebrow"),
            message: t("empty_state_no_feeds_title"),
            description: t("empty_state_no_feeds_description"),
            hints: [t("empty_state_no_feeds_add_hint"), t("empty_state_no_feeds_discovery_hint")],
            containerClassName: undefined,
            cardClassName: undefined,
            actions: [{ label: t("add_feed"), onClick: openAddFeedDialog, variant: "default" }],
          }
        : {
            eyebrow: undefined,
            message: t("select_article_to_read"),
            description: t("empty_state_default_description"),
            hints: [t("empty_state_search_hint"), t("empty_state_web_preview_hint")],
            // Align passive cards with the adjacent search-empty surface while avoiding header overlap.
            containerClassName: readerPassiveCardOffsetClassName,
            cardClassName: undefined,
            actions: [],
          };

  return (
    <ArticleEmptyStateShell
      toolbar={
        <ArticleToolbar article={null} isBrowserOpen={false} onCloseView={() => {}} onToggleBrowserOverlay={() => {}} />
      }
      body={
        <ArticleEmptyStateView
          eyebrow={content.eyebrow}
          message={content.message}
          description={content.description}
          hints={content.hints}
          containerClassName={content.containerClassName}
          cardClassName={content.cardClassName}
          actions={content.actions}
        />
      }
    />
  );
}

function BrowserOnlyState() {
  const { closeBrowser } = useArticleViewUiState();

  return <BrowserOnlyStateView onCloseOverlay={closeBrowser} />;
}

export function ArticleView() {
  const { t } = useTranslation("reader");
  const selectionState = useArticleViewSelection();

  if (selectionState.kind === "subscriptions-index") {
    return (
      <Suspense fallback={null}>
        <LazySubscriptionsIndexPage />
      </Suspense>
    );
  }

  if (selectionState.kind === "browser-only") {
    return <BrowserOnlyState />;
  }

  if (selectionState.kind === "empty") {
    return <EmptyState emptyReason={selectionState.emptyReason} summary={selectionState.summary} />;
  }

  if (selectionState.kind === "not-found") {
    return <ArticleNotFoundStateView message={t("article_not_found")} />;
  }

  return (
    <ArticlePane article={selectionState.article} feed={selectionState.feed} feedName={selectionState.feed?.title} />
  );
}
