import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSetRead, useToggleStar } from "@/hooks/use-articles";
import { usePlatformStore } from "@/stores/platform-store";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { ArticleShareMenu } from "./article-share-menu";
import type { ArticleToolbarActionStripProps, UseArticleToolbarControlsParams } from "./article-toolbar.types";
import { useArticleActions } from "./use-article-actions";

export function useArticleToolbarControls({
  article,
  isBrowserOpen,
  onToggleBrowserOverlay,
  keyboardShortcuts,
}: UseArticleToolbarControlsParams): ArticleToolbarActionStripProps {
  const { t } = useTranslation("reader");
  const setRead = useSetRead();
  const toggleStar = useToggleStar();
  const showToast = useUiStore((s) => s.showToast);
  const addRecentlyRead = useUiStore((s) => s.addRecentlyRead);
  const retainArticle = useUiStore((s) => s.retainArticle);
  const selection = useUiStore((s) => s.selection);
  const viewMode = useUiStore((s) => s.viewMode);
  const retainOnUnstar = viewMode === "starred" || (selection.type === "smart" && selection.kind === "starred");
  const actionCopyLink = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "action_copy_link"));
  const supportsReadingList = usePlatformStore((s) => s.platform.capabilities.supports_reading_list);
  const { setReadStatus, setStarStatus, handleOpenExternalBrowser, handleCopyLink } = useArticleActions({
    article,
    viewMode,
    retainOnUnstar,
    supportsReadingList,
    showToast,
    addRecentlyRead,
    retainArticle,
    setRead,
    toggleStar,
    keyboardShortcuts,
  });

  const shareMenuControl = useMemo(
    () => (
      <ArticleShareMenu
        article={article}
        supportsReadingList={supportsReadingList}
        showToast={showToast}
        labels={{
          share: t("share"),
          copyLink: t("copy_link"),
          addToReadingList: t("add_to_reading_list"),
          addedToReadingList: t("added_to_reading_list"),
          shareViaEmail: t("share_via_email"),
          linkCopied: t("link_copied"),
        }}
      />
    ),
    [article, showToast, supportsReadingList, t],
  );

  return {
    canToggleRead: article !== null,
    canToggleStar: article !== null,
    isRead: article?.is_read ?? false,
    isStarred: article?.is_starred ?? false,
    isBrowserOpen,
    showCopyLinkButton: actionCopyLink === "true",
    canCopyLink: Boolean(article?.url),
    showOpenInBrowserButton: true,
    canOpenInBrowser: Boolean(article?.url),
    showOpenInExternalBrowserButton: true,
    canOpenInExternalBrowser: Boolean(article?.url),
    shareMenuControl,
    labels: {
      closeView: t("close_view"),
      toggleRead: t("toggle_read"),
      toggleStar: t("toggle_star"),
      previewToggleOff: t("open_in_browser"),
      previewToggleOn: t("close_browser_overlay"),
      copyLink: t("copy_link"),
      openInExternalBrowser: t("open_in_external_browser"),
      moreActions: t("more_actions"),
    },
    onToggleRead: setReadStatus,
    onToggleStar: (pressed) => setStarStatus(pressed, { showStatusToast: true }),
    onCopyLink: handleCopyLink,
    onOpenInBrowser: onToggleBrowserOverlay,
    onOpenInExternalBrowser: handleOpenExternalBrowser,
  };
}
