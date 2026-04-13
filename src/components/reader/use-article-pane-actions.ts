import { Result } from "@praha/byethrow";
import type { UseMutationResult } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto } from "@/api/tauri-commands";
import { addToReadingList, copyToClipboard, openInBrowser } from "@/api/tauri-commands";
import { keyboardEvents } from "@/lib/keyboard-shortcuts";
import { usePreferencesStore } from "@/stores/preferences-store";

type SetReadMutation = UseMutationResult<unknown, Error, { id: string; read: boolean }, unknown>;
type ToggleStarMutation = UseMutationResult<unknown, Error, { id: string; starred: boolean }, unknown>;
type ShowToast = (message: string) => void;

type UseArticlePaneActionsParams = {
  article: ArticleDto;
  viewMode: "all" | "unread" | "starred";
  supportsReadingList: boolean;
  showToast: ShowToast;
  addRecentlyRead: (articleId: string) => void;
  retainArticle: (articleId: string) => void;
  setRead: SetReadMutation;
  toggleStar: ToggleStarMutation;
  onToggleBrowserOverlay: () => void;
  onCloseBrowserOverlay: () => void;
};

type UseArticlePaneActionsResult = {
  setReadStatus: (pressed: boolean) => void;
  setStarStatus: (pressed: boolean, options?: { showStatusToast?: boolean }) => void;
  handleToggleRead: () => void;
  handleToggleStar: () => void;
  handleOpenExternalBrowser: () => void;
  handleCopyLink: () => void;
  handleAddToReadingList: () => void;
};

function openArticleInExternalBrowser(url: string, showToast: ShowToast) {
  const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
  return openInBrowser(url, bg).then((result) =>
    Result.pipe(
      result,
      Result.inspectError((error) => {
        console.error("Failed to open in browser:", error);
        showToast(error.message);
      }),
    ),
  );
}

export function useArticlePaneActions({
  article,
  viewMode,
  supportsReadingList,
  showToast,
  addRecentlyRead,
  retainArticle,
  setRead,
  toggleStar,
  onToggleBrowserOverlay,
  onCloseBrowserOverlay,
}: UseArticlePaneActionsParams): UseArticlePaneActionsResult {
  const { t } = useTranslation("reader");

  const retainIfNeeded = useCallback(
    (nextRead: boolean) => {
      if (nextRead && viewMode === "unread") {
        retainArticle(article.id);
      }
    },
    [article.id, retainArticle, viewMode],
  );

  const setReadStatus = useCallback(
    (pressed: boolean) => {
      retainIfNeeded(pressed);
      setRead.mutate(
        { id: article.id, read: pressed },
        {
          onSuccess: () => {
            if (pressed) {
              addRecentlyRead(article.id);
            }
          },
        },
      );
    },
    [addRecentlyRead, article.id, retainIfNeeded, setRead],
  );

  const setStarStatus = useCallback(
    (pressed: boolean, options?: { showStatusToast?: boolean }) => {
      toggleStar.mutate(
        { id: article.id, starred: pressed },
        {
          onSuccess: () => {
            if (!pressed && viewMode === "starred") {
              retainArticle(article.id);
            }
            if (options?.showStatusToast) {
              showToast(pressed ? t("article_starred") : t("article_unstarred"));
            }
          },
        },
      );
    },
    [article.id, retainArticle, showToast, t, toggleStar, viewMode],
  );

  const handleToggleRead = useCallback(() => {
    setReadStatus(!article.is_read);
  }, [article.is_read, setReadStatus]);

  const handleToggleStar = useCallback(() => {
    setStarStatus(!article.is_starred);
  }, [article.is_starred, setStarStatus]);

  const handleOpenExternalBrowser = useCallback(() => {
    if (!article.url) {
      return;
    }

    void openArticleInExternalBrowser(article.url, showToast);
  }, [article.url, showToast]);

  const handleCopyLink = useCallback(() => {
    if (!article.url) {
      return;
    }

    void copyToClipboard(article.url).then((result) =>
      Result.pipe(
        result,
        Result.inspect(() => showToast(t("link_copied"))),
        Result.inspectError((error) => {
          console.error("Copy failed:", error);
          showToast(error.message);
        }),
      ),
    );
  }, [article.url, showToast, t]);

  const handleAddToReadingList = useCallback(() => {
    if (!supportsReadingList || !article.url) {
      return;
    }

    void addToReadingList(article.url).then((result) =>
      Result.pipe(
        result,
        Result.inspect(() => showToast(t("added_to_reading_list"))),
        Result.inspectError((error) => {
          console.error("Add to reading list failed:", error);
          showToast(error.message);
        }),
      ),
    );
  }, [article.url, showToast, supportsReadingList, t]);

  useEffect(() => {
    window.addEventListener(keyboardEvents.openInAppBrowser, onToggleBrowserOverlay);
    window.addEventListener(keyboardEvents.closeBrowserOverlay, onCloseBrowserOverlay);
    window.addEventListener(keyboardEvents.toggleRead, handleToggleRead);
    window.addEventListener(keyboardEvents.toggleStar, handleToggleStar);
    window.addEventListener(keyboardEvents.openExternalBrowser, handleOpenExternalBrowser);
    window.addEventListener(keyboardEvents.copyLink, handleCopyLink);
    window.addEventListener(keyboardEvents.addToReadingList, handleAddToReadingList);
    return () => {
      window.removeEventListener(keyboardEvents.openInAppBrowser, onToggleBrowserOverlay);
      window.removeEventListener(keyboardEvents.closeBrowserOverlay, onCloseBrowserOverlay);
      window.removeEventListener(keyboardEvents.toggleRead, handleToggleRead);
      window.removeEventListener(keyboardEvents.toggleStar, handleToggleStar);
      window.removeEventListener(keyboardEvents.openExternalBrowser, handleOpenExternalBrowser);
      window.removeEventListener(keyboardEvents.copyLink, handleCopyLink);
      window.removeEventListener(keyboardEvents.addToReadingList, handleAddToReadingList);
    };
  }, [
    handleAddToReadingList,
    handleCopyLink,
    handleOpenExternalBrowser,
    handleToggleRead,
    handleToggleStar,
    onCloseBrowserOverlay,
    onToggleBrowserOverlay,
  ]);

  return {
    setReadStatus,
    setStarStatus,
    handleToggleRead,
    handleToggleStar,
    handleOpenExternalBrowser,
    handleCopyLink,
    handleAddToReadingList,
  };
}
