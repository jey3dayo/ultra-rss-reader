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

type KeyboardShortcutHandlers = {
  onToggleBrowserOverlay: () => void;
  onCloseBrowserOverlay: () => void;
};

type UseArticleActionsParams = {
  article: ArticleDto | null;
  viewMode: "all" | "unread" | "starred";
  supportsReadingList: boolean;
  showToast: ShowToast;
  addRecentlyRead: (articleId: string) => void;
  retainArticle: (articleId: string) => void;
  setRead: SetReadMutation;
  toggleStar: ToggleStarMutation;
  keyboardShortcuts?: KeyboardShortcutHandlers;
};

type UseArticleActionsResult = {
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

export function useArticleActions({
  article,
  viewMode,
  supportsReadingList,
  showToast,
  addRecentlyRead,
  retainArticle,
  setRead,
  toggleStar,
  keyboardShortcuts,
}: UseArticleActionsParams): UseArticleActionsResult {
  const { t } = useTranslation("reader");
  const articleId = article?.id ?? null;
  const articleUrl = article?.url ?? null;
  const isRead = article?.is_read ?? false;
  const isStarred = article?.is_starred ?? false;

  const retainIfNeeded = useCallback(
    (nextRead: boolean) => {
      if (!articleId) {
        return;
      }

      if (nextRead && viewMode === "unread") {
        retainArticle(articleId);
      }
    },
    [articleId, retainArticle, viewMode],
  );

  const setReadStatus = useCallback(
    (pressed: boolean) => {
      if (!articleId) {
        return;
      }

      retainIfNeeded(pressed);
      setRead.mutate(
        { id: articleId, read: pressed },
        {
          onSuccess: () => {
            if (pressed) {
              addRecentlyRead(articleId);
            }
          },
        },
      );
    },
    [addRecentlyRead, articleId, retainIfNeeded, setRead],
  );

  const setStarStatus = useCallback(
    (pressed: boolean, options?: { showStatusToast?: boolean }) => {
      if (!articleId) {
        return;
      }

      toggleStar.mutate(
        { id: articleId, starred: pressed },
        {
          onSuccess: () => {
            if (!pressed && viewMode === "starred") {
              retainArticle(articleId);
            }
            if (options?.showStatusToast) {
              showToast(pressed ? t("article_starred") : t("article_unstarred"));
            }
          },
        },
      );
    },
    [articleId, retainArticle, showToast, t, toggleStar, viewMode],
  );

  const handleToggleRead = useCallback(() => {
    if (!articleId) {
      return;
    }

    setReadStatus(!isRead);
  }, [articleId, isRead, setReadStatus]);

  const handleToggleStar = useCallback(() => {
    if (!articleId) {
      return;
    }

    setStarStatus(!isStarred);
  }, [articleId, isStarred, setStarStatus]);

  const handleOpenExternalBrowser = useCallback(() => {
    if (!articleUrl) {
      return;
    }

    void openArticleInExternalBrowser(articleUrl, showToast);
  }, [articleUrl, showToast]);

  const handleCopyLink = useCallback(() => {
    if (!articleUrl) {
      return;
    }

    void copyToClipboard(articleUrl).then((result) =>
      Result.pipe(
        result,
        Result.inspect(() => showToast(t("link_copied"))),
        Result.inspectError((error) => {
          console.error("Copy failed:", error);
          showToast(error.message);
        }),
      ),
    );
  }, [articleUrl, showToast, t]);

  const handleAddToReadingList = useCallback(() => {
    if (!supportsReadingList || !articleUrl) {
      return;
    }

    void addToReadingList(articleUrl).then((result) =>
      Result.pipe(
        result,
        Result.inspect(() => showToast(t("added_to_reading_list"))),
        Result.inspectError((error) => {
          console.error("Add to reading list failed:", error);
          showToast(error.message);
        }),
      ),
    );
  }, [articleUrl, showToast, supportsReadingList, t]);

  useEffect(() => {
    if (!keyboardShortcuts) {
      return;
    }

    window.addEventListener(keyboardEvents.openInAppBrowser, keyboardShortcuts.onToggleBrowserOverlay);
    window.addEventListener(keyboardEvents.closeBrowserOverlay, keyboardShortcuts.onCloseBrowserOverlay);
    window.addEventListener(keyboardEvents.toggleRead, handleToggleRead);
    window.addEventListener(keyboardEvents.toggleStar, handleToggleStar);
    window.addEventListener(keyboardEvents.openExternalBrowser, handleOpenExternalBrowser);
    window.addEventListener(keyboardEvents.copyLink, handleCopyLink);
    window.addEventListener(keyboardEvents.addToReadingList, handleAddToReadingList);

    return () => {
      window.removeEventListener(keyboardEvents.openInAppBrowser, keyboardShortcuts.onToggleBrowserOverlay);
      window.removeEventListener(keyboardEvents.closeBrowserOverlay, keyboardShortcuts.onCloseBrowserOverlay);
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
    keyboardShortcuts,
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
