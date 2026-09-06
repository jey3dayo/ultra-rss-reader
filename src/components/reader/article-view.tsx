import { type ComponentProps, lazy, Suspense, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useArticleViewSelection } from "@/components/reader/hooks/article/use-article-view-selection";
import { useArticleViewUiState } from "@/components/reader/hooks/article/use-article-view-ui-state";
import type { ArticleViewSummaryState } from "@/lib/articles/article-view";
import i18n from "@/lib/i18n";
import { useI18nResourceNamespace } from "@/lib/i18n/use-i18n-resource-namespace";
import { loadI18nResourceNamespace } from "@/lib/i18n-resources";
import { cn } from "@/lib/utils";
import { resolvePreferenceValue } from "@/schemas/preference-values";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { ArticleEmptyStateView } from "./article-empty-state-view";
import { ArticlePane, ArticleToolbar } from "./article-pane-view";
import { SelectionSummaryEmptyState } from "./article-selection-summary";
import { ArticleEmptyStateShell, ArticleNotFoundStateView, BrowserOnlyStateView } from "./article-view-state";
import {
  readerPassiveCardClassName,
  readerPassiveCardOffsetClassName,
  readerPassiveCardPaddingClassName,
} from "./reader-passive-card";

const LazySubscriptionsIndexPage = lazy(async () => {
  await loadI18nResourceNamespace(i18n, "subscriptions");
  const mod = await import("../subscriptions-index/subscriptions-index-page");
  return { default: mod.SubscriptionsIndexPage };
});

export { ArticlePane, ArticleToolbar } from "./article-pane-view";

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

type ArticleEmptyStateViewProps = ComponentProps<typeof ArticleEmptyStateView>;

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
            cardClassName: cn(readerPassiveCardClassName, readerPassiveCardPaddingClassName),
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
          animateCardEntrance={emptyReason !== "default"}
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
  const openFirstArticleOnSelection =
    usePreferencesStore((state) => resolvePreferenceValue(state.prefs, "open_first_article_on_feed_selection")) ===
    "true";
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

    const isSourceSelection = selection.type === "feed" || selection.type === "folder" || selection.type === "tag";
    if (isSourceSelection && !openFirstArticleOnSelection) {
      return;
    }
    landedSelectionKeyRef.current = selectionLandingKey;

    selectArticle(landingArticleId, { engagement: "preview" });
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
    openFirstArticleOnSelection,
    selectArticle,
    selection.type,
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

  if (selectionState.kind === "loading") {
    return (
      <ArticleEmptyStateShell
        toolbar={
          <ArticleToolbar
            article={null}
            isBrowserOpen={false}
            onCloseView={() => {}}
            onToggleBrowserOverlay={() => {}}
          />
        }
        body={null}
      />
    );
  }

  if (selectionState.kind === "not-found") {
    return <ArticleNotFoundStateView message={t("article_not_found")} />;
  }

  return (
    <ArticlePane
      article={selectionState.article}
      feed={selectionState.feed}
      feedName={selectionState.feed?.title}
      hasNextArticle={selectionState.hasNextArticle}
    />
  );
}
