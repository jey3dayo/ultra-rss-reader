import { FolderClosed, History, Inbox, List, Star, Tag as TagIcon } from "lucide-react";
import { type ComponentProps, lazy, type ReactNode, Suspense, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useArticleViewSelection } from "@/components/reader/hooks/article/use-article-view-selection";
import { useArticleViewUiState } from "@/components/reader/hooks/article/use-article-view-ui-state";
import { Button, FeedFavicon, MotionNumber } from "@/design-system";
import { type ArticleViewSummaryState, resolveArticleDateLocale } from "@/lib/articles/article-view";
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

const SUMMARY_CONTAINER_CLASS_NAME = `w-full max-w-[48rem] ${readerPassiveCardOffsetClassName}`;

type ArticleEmptyStateViewProps = ComponentProps<typeof ArticleEmptyStateView>;

type SummaryIdentityProps = {
  title: string;
  leadingVisual?: ReactNode;
  countLabel: string;
  countValue: ReactNode;
  accentTone?: "unread" | "starred";
  primaryAction?: {
    label: string;
    ariaLabel?: string;
    onClick: () => void;
  };
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

function SummaryEmptyState({
  title,
  leadingVisual,
  accentTone,
  countLabel,
  countValue,
  primaryAction,
}: SummaryIdentityProps) {
  return (
    <ArticleEmptyStateShell
      toolbar={
        <ArticleToolbar article={null} isBrowserOpen={false} onCloseView={() => {}} onToggleBrowserOverlay={() => {}} />
      }
      body={
        <div className="flex flex-1 items-center justify-center overflow-hidden px-6 pt-6 pb-12">
          <div
            data-testid="article-selection-summary"
            data-selection-identity=""
            data-selection-identity-accent={accentTone}
            className={SUMMARY_CONTAINER_CLASS_NAME}
          >
            <section
              aria-label={title}
              className="mx-auto flex min-h-[18rem] max-w-[34rem] flex-col items-center justify-center px-4 text-center"
            >
              {leadingVisual ? (
                <div
                  data-testid="article-selection-leading-visual"
                  className="mb-5 flex size-16 items-center justify-center text-foreground-soft"
                >
                  {leadingVisual}
                </div>
              ) : null}
              <h3 className="max-w-full truncate font-sans text-xl font-medium leading-tight text-foreground">
                {title}
              </h3>
              <p className="mt-1 font-sans text-sm font-medium text-[var(--color-unread)]">
                <span className="tabular-nums">{countValue}</span>
                <span className="ml-1">{countLabel}</span>
              </p>
              {primaryAction ? (
                <div className="mt-6">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={primaryAction.ariaLabel}
                    onClick={primaryAction.onClick}
                    className="h-8 text-foreground-soft hover:text-foreground"
                  >
                    <List className="size-4" aria-hidden="true" />
                    <span>{primaryAction.label}</span>
                  </Button>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      }
    />
  );
}

function buildSummaryIdentityProps(
  summary: ArticleViewSummaryState,
  locale: string,
  readerT: ReturnType<typeof useTranslation<"reader">>["t"],
  sidebarT: ReturnType<typeof useTranslation<"sidebar">>["t"],
): SummaryIdentityProps {
  if (summary.kind === "feed") {
    return {
      title: summary.feed.title,
      leadingVisual: (
        <FeedFavicon title={summary.feed.title} url={summary.feed.url} siteUrl={summary.feed.site_url} size="lg" />
      ),
      countLabel: readerT("unread"),
      countValue: renderSummaryCount(summary.feed.unread_count, locale),
      accentTone: "unread",
    };
  }

  if (summary.kind === "folder") {
    return {
      title: summary.folder.name,
      leadingVisual: <FolderClosed className="size-9 stroke-[1.5] text-foreground-soft" />,
      countLabel: readerT("unread"),
      countValue: renderSummaryCount(summary.unreadCount, locale),
      accentTone: "unread",
    };
  }

  if (summary.kind === "tag") {
    return {
      title: summary.tag.name,
      leadingVisual: summary.tag.color ? (
        <span className="inline-block size-8 rounded-full" style={{ backgroundColor: summary.tag.color }} />
      ) : (
        <TagIcon className="size-9 stroke-[1.5] text-foreground-soft" />
      ),
      countLabel: readerT("articles"),
      countValue: renderSummaryCount(summary.articleCount, locale),
    };
  }

  const smartSummaryView = {
    unread: {
      title: sidebarT("unread"),
      leadingVisual: <Inbox className="size-5" />,
      accentTone: "unread" as const,
    },
    starred: {
      title: sidebarT("starred"),
      leadingVisual: <Star className="size-5" />,
      accentTone: "starred" as const,
    },
    recent: {
      title: sidebarT("recent_articles"),
      leadingVisual: <History className="size-5 text-foreground-soft" />,
      accentTone: undefined,
    },
  }[summary.smartKind];

  return {
    title: smartSummaryView.title,
    leadingVisual: smartSummaryView.leadingVisual,
    accentTone: smartSummaryView.accentTone,
    countLabel: readerT("articles"),
    countValue: renderSummaryCount(summary.articleCount, locale),
  };
}

function SelectionSummaryEmptyState({ summary }: { summary: ArticleViewSummaryState }) {
  const { t } = useTranslation("reader");
  const { t: sidebarT } = useTranslation("sidebar");
  const { i18n } = useTranslation("reader");
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const openSubscriptionsIndex = useUiStore((state) => state.openSubscriptionsIndex);
  const locale = resolveArticleDateLocale(i18n.language);
  const identityProps = buildSummaryIdentityProps(summary, locale, t, sidebarT);
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

  return <SummaryEmptyState {...identityProps} primaryAction={primaryAction} />;
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
  }, [focusedPane, landingArticleId, landingBrowserUrl, openBrowser, selectArticle, selectionLandingKey, selectionState.kind]);

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
