import { Clock3, Folder, Hash, Inbox, Star } from "lucide-react";
import { type ComponentProps, lazy, type ReactNode, Suspense, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useArticleViewSelection } from "@/components/reader/hooks/article/use-article-view-selection";
import { useArticleViewUiState } from "@/components/reader/hooks/article/use-article-view-ui-state";
import { FeedFavicon, MotionNumber } from "@/design-system";
import {
  type ArticleViewSummaryFeed,
  type ArticleViewSummaryState,
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
import { readerPassiveCardOffsetClassName } from "./reader-passive-card";

const LazySubscriptionsIndexPage = lazy(async () => {
  await loadI18nResourceNamespace(i18n, "subscriptions");
  const mod = await import("../subscriptions-index/subscriptions-index-page");
  return { default: mod.SubscriptionsIndexPage };
});

export { ArticlePane, ArticleToolbar } from "./article-pane-view";

const SUMMARY_CONTAINER_CLASS_NAME = "w-full max-w-[39rem]";

type ArticleEmptyStateViewProps = ComponentProps<typeof ArticleEmptyStateView>;

type SummaryIdentityProps = {
  label: string;
  value: ReactNode;
  kind?: "count" | "date";
};

type SummaryScopeProps = {
  title: string;
  subtitle: ReactNode;
  visual: ReactNode;
  metrics: SummaryIdentityProps[];
  recentFeeds: ArticleViewSummaryFeed[];
  accentTone?: "unread" | "starred";
};

function resolveSelectionLandingKey(
  selection: ReturnType<typeof useUiStore.getState>["selection"],
  viewMode: ReturnType<typeof useUiStore.getState>["viewMode"],
) {
  switch (selection.type) {
    case "feed":
      return `feed:${selection.feedId}:${viewMode}`;
    case "folder":
      return `folder:${selection.folderId}:${viewMode}`;
    case "smart":
      return `smart:${selection.kind}:${viewMode}`;
    case "tag":
      return `tag:${selection.tagId}:${viewMode}`;
    case "all":
      return `all:${viewMode}`;
  }
}

function renderSummaryCount(value: number, locale: string) {
  const label = value.toLocaleString(locale);

  return <MotionNumber key={label} value={label} />;
}

function SummaryMetric({ label, value, kind = "count" }: SummaryIdentityProps) {
  const valueClassName =
    kind === "date"
      ? "flex h-[1.55rem] items-end font-sans text-[1.08rem] font-medium leading-[1.08] tracking-normal text-foreground tabular-nums"
      : "font-sans text-[1.55rem] font-medium leading-none tracking-normal text-foreground tabular-nums";

  return (
    <div className="min-w-0" data-summary-metric-kind={kind}>
      <p className={valueClassName}>{value}</p>
      <p className="mt-1 text-[0.7rem] leading-tight text-foreground-soft">{label}</p>
    </div>
  );
}

function RecentFeedRow({ feed }: { feed: ArticleViewSummaryFeed }) {
  return (
    <li className="min-w-0">
      <div className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-border/55 bg-surface-1/52 px-2.5 text-sm shadow-none dark:border-border/70 dark:bg-surface-2/42">
        <FeedFavicon title={feed.title} url={feed.url} siteUrl={feed.site_url} size="sm" />
        <span className="min-w-0 flex-1 truncate text-foreground" dir="auto">
          {feed.title}
        </span>
        <span className="shrink-0 text-xs text-foreground-soft tabular-nums">{feed.unread_count.toLocaleString()}</span>
      </div>
    </li>
  );
}

function SummaryEmptyState({ title, subtitle, visual, metrics, recentFeeds, accentTone }: SummaryScopeProps) {
  const { t } = useTranslation("reader");

  return (
    <ArticleEmptyStateShell
      toolbar={
        <ArticleToolbar article={null} isBrowserOpen={false} onCloseView={() => {}} onToggleBrowserOverlay={() => {}} />
      }
      body={
        <div className="flex flex-1 items-start justify-start overflow-hidden px-10 pt-[7vh] pb-12">
          <section
            data-testid="article-selection-summary"
            data-selection-identity=""
            data-selection-identity-accent={accentTone}
            aria-label={title}
            className={SUMMARY_CONTAINER_CLASS_NAME}
          >
            <div className="w-full px-1">
              <div className="mb-7 flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-md text-foreground-soft"
                >
                  {visual}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-sans text-xl font-semibold leading-tight text-foreground" dir="auto">
                    {title}
                  </p>
                  <p className="mt-1 text-xs leading-tight text-foreground-soft">{subtitle}</p>
                </div>
              </div>
              <div
                className="grid grid-cols-2 gap-x-9 gap-y-5 min-[34rem]:grid-cols-[repeat(3,minmax(4rem,1fr))_minmax(7.5rem,1.2fr)]"
                data-testid="article-selection-summary-metrics"
              >
                {metrics.map((metric) => (
                  <SummaryMetric key={metric.label} {...metric} />
                ))}
              </div>
              {recentFeeds.length > 0 ? (
                <div className="mt-8">
                  <h3 className="text-sm font-medium text-foreground">{t("recent_feeds")}</h3>
                  <ul className="mt-3 grid grid-cols-2 gap-2">
                    {recentFeeds.map((feed) => (
                      <RecentFeedRow key={feed.id} feed={feed} />
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      }
    />
  );
}

function formatRelativeSummaryTime(value: string | null | undefined, locale: string): string {
  if (!value) {
    return "—";
  }

  const publishedTime = new Date(value).getTime();
  if (Number.isNaN(publishedTime)) {
    return "—";
  }

  const diffMs = Date.now() - publishedTime;
  if (diffMs < 0) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(0, "minute");
  }

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (diffMs < hour) {
    return formatter.format(-Math.max(1, Math.round(diffMs / minute)), "minute");
  }

  if (diffMs < day) {
    return formatter.format(-Math.round(diffMs / hour), "hour");
  }

  return formatter.format(-Math.round(diffMs / day), "day");
}

function buildSummaryIdentityProps(
  summary: ArticleViewSummaryState,
  locale: string,
  readerT: ReturnType<typeof useTranslation<"reader">>["t"],
  sidebarT: ReturnType<typeof useTranslation<"sidebar">>["t"],
): SummaryScopeProps {
  const latestUpdate = formatRelativeSummaryTime(summary.latestArticlePublishedAt, locale);
  const buildMetrics = (params: {
    unreadCount: number;
    todayArticleCount: number;
    weekArticleCount: number;
  }): SummaryIdentityProps[] => [
    {
      label: readerT("unread"),
      value: renderSummaryCount(params.unreadCount, locale),
    },
    {
      label: readerT("today_published"),
      value: renderSummaryCount(params.todayArticleCount, locale),
    },
    {
      label: readerT("week_new"),
      value: renderSummaryCount(params.weekArticleCount, locale),
    },
    {
      label: readerT("latest_update"),
      value: latestUpdate,
      kind: "date",
    },
  ];

  if (summary.kind === "feed") {
    const websiteHref = resolveArticleSummaryWebsiteHref(summary.feed);
    const websiteLabel = resolveArticleSummaryWebsiteLabel(summary.feed);

    return {
      title: summary.feed.title,
      subtitle:
        websiteHref && websiteLabel ? (
          <a
            href={websiteHref}
            className="underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
          >
            {websiteLabel}
          </a>
        ) : (
          readerT("feed_or_site_url")
        ),
      visual: (
        <FeedFavicon title={summary.feed.title} url={summary.feed.url} siteUrl={summary.feed.site_url} size="md" />
      ),
      metrics: buildMetrics({
        unreadCount: summary.feed.unread_count,
        todayArticleCount: summary.todayArticleCount,
        weekArticleCount: summary.weekArticleCount,
      }),
      recentFeeds: [],
      accentTone: "unread",
    };
  }

  if (summary.kind === "folder") {
    return {
      title: summary.folder.name,
      subtitle: readerT("summary_feed_count", { count: summary.feedCount }),
      visual: <Folder className="size-4" />,
      metrics: buildMetrics({
        unreadCount: summary.unreadCount,
        todayArticleCount: summary.todayArticleCount,
        weekArticleCount: summary.weekArticleCount,
      }),
      recentFeeds: summary.recentFeeds,
      accentTone: "unread",
    };
  }

  if (summary.kind === "tag") {
    return {
      title: summary.tag.name,
      subtitle: readerT("summary_feed_count", { count: summary.feedCount }),
      visual: <Hash className="size-4" />,
      metrics: buildMetrics({
        unreadCount: summary.unreadCount,
        todayArticleCount: summary.todayArticleCount,
        weekArticleCount: summary.weekArticleCount,
      }),
      recentFeeds: summary.recentFeeds,
    };
  }

  const smartSummaryView = {
    unread: {
      title: sidebarT("unread"),
      visual: <Inbox className="size-4" />,
      accentTone: "unread" as const,
    },
    starred: {
      title: sidebarT("starred"),
      visual: <Star className="size-4" />,
      accentTone: "starred" as const,
    },
    recent: {
      title: sidebarT("recent_articles"),
      visual: <Clock3 className="size-4" />,
      accentTone: undefined,
    },
  }[summary.smartKind];

  return {
    title: smartSummaryView.title,
    subtitle: readerT("summary_article_count", { count: summary.articleCount }),
    visual: smartSummaryView.visual,
    accentTone: smartSummaryView.accentTone,
    metrics: buildMetrics({
      unreadCount: summary.unreadCount,
      todayArticleCount: summary.todayArticleCount,
      weekArticleCount: summary.weekArticleCount,
    }),
    recentFeeds: summary.recentFeeds,
  };
}

function SelectionSummaryEmptyState({ summary }: { summary: ArticleViewSummaryState }) {
  const { t } = useTranslation("reader");
  const { t: sidebarT } = useTranslation("sidebar");
  const { i18n } = useTranslation("reader");
  const locale = resolveArticleDateLocale(i18n.language);
  const identityProps = buildSummaryIdentityProps(summary, locale, t, sidebarT);

  return <SummaryEmptyState {...identityProps} />;
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
  const selectArticle = useUiStore((state) => state.selectArticle);
  const openBrowser = useUiStore((state) => state.openBrowser);
  const selection = useUiStore((state) => state.selection);
  const viewMode = useUiStore((state) => state.viewMode);
  const focusedPane = useUiStore((state) => state.focusedPane);
  const landedSelectionKeyRef = useRef<string | null>(null);
  const selectionLandingKey = resolveSelectionLandingKey(selection, viewMode);
  const landingCandidate = selectionState.kind === "empty" ? selectionState.landingCandidate : undefined;
  const landingArticleId = landingCandidate?.article.id;
  const landingBrowserUrl = landingCandidate?.browserUrl;

  useEffect(() => {
    if (selectionState.kind === "article") {
      landedSelectionKeyRef.current = selectionLandingKey;
      return;
    }

    if (!landingArticleId) {
      return;
    }

    if (landedSelectionKeyRef.current === selectionLandingKey) {
      return;
    }
    landedSelectionKeyRef.current = selectionLandingKey;

    selectArticle(landingArticleId);
    if (landingBrowserUrl) {
      openBrowser(landingBrowserUrl);
      return;
    }
    if (focusedPane === "list") {
      useUiStore.setState({ focusedPane: "list" });
    }
  }, [
    focusedPane,
    landingArticleId,
    landingBrowserUrl,
    openBrowser,
    selectArticle,
    selectionLandingKey,
    selectionState.kind,
  ]);

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
