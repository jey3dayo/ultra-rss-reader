import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "@/stores/ui-store";
import { ArticleEmptyStateView } from "./article-empty-state-view";
import { ArticlePane, ArticleToolbar } from "./article-pane-view";
import { ArticleEmptyStateShell, ArticleNotFoundStateView, BrowserOnlyStateView } from "./article-view-state";
import { useArticleViewSelection } from "./use-article-view-selection";
import { useArticleViewUiState } from "./use-article-view-ui-state";

const LazyFeedCleanupPage = lazy(async () => {
  const mod = await import("../feed-cleanup/feed-cleanup-page");
  return { default: mod.FeedCleanupPage };
});

const LazySubscriptionsIndexPage = lazy(async () => {
  const mod = await import("../subscriptions-index/subscriptions-index-page");
  return { default: mod.SubscriptionsIndexPage };
});

export { ArticlePane, ArticleToolbar } from "./article-pane-view";

function EmptyState({ emptyReason }: { emptyReason: "default" | "no-accounts" | "no-feeds" }) {
  const { t } = useTranslation("reader");
  const { t: settingsT } = useTranslation("settings");
  const openSettings = useUiStore((state) => state.openSettings);
  const setSettingsAddAccount = useUiStore((state) => state.setSettingsAddAccount);
  const openAddFeedDialog = useUiStore((state) => state.openAddFeedDialog);

  const openAddAccountSettings = () => {
    openSettings("accounts");
    setSettingsAddAccount(true);
  };

  const content =
    emptyReason === "no-accounts"
      ? {
          eyebrow: t("empty_state_no_accounts_eyebrow"),
          message: t("empty_state_no_accounts_title"),
          description: t("empty_state_no_accounts_description"),
          hints: [t("empty_state_no_accounts_sidebar_hint"), t("empty_state_no_accounts_settings_hint")],
          actions: [{ label: settingsT("add_account_ellipsis"), onClick: openAddAccountSettings, variant: "default" as const }],
        }
      : emptyReason === "no-feeds"
        ? {
            eyebrow: t("empty_state_no_feeds_eyebrow"),
            message: t("empty_state_no_feeds_title"),
            description: t("empty_state_no_feeds_description"),
            hints: [t("empty_state_no_feeds_add_hint"), t("empty_state_no_feeds_discovery_hint")],
            actions: [{ label: t("add_feed"), onClick: openAddFeedDialog, variant: "default" as const }],
          }
        : {
            eyebrow: t("empty_state_default_eyebrow"),
            message: t("select_article_to_read"),
            description: t("empty_state_default_description"),
            hints: [t("empty_state_search_hint"), t("empty_state_web_preview_hint")],
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

  if (selectionState.kind === "feed-cleanup") {
    return (
      <Suspense fallback={null}>
        <LazyFeedCleanupPage />
      </Suspense>
    );
  }

  if (selectionState.kind === "browser-only") {
    return <BrowserOnlyState />;
  }

  if (selectionState.kind === "empty") {
    return <EmptyState emptyReason={selectionState.emptyReason} />;
  }

  if (selectionState.kind === "not-found") {
    return <ArticleNotFoundStateView message={t("article_not_found")} />;
  }

  return (
    <ArticlePane article={selectionState.article} feed={selectionState.feed} feedName={selectionState.feed?.title} />
  );
}
