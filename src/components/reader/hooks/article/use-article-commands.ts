import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto } from "@/api/tauri-commands";
import {
  clearManualUnreadAutoMarkSuppression,
  suppressAutoMarkAfterManualUnread,
} from "@/components/reader/hooks/article/use-article-auto-mark";
import { useSetRead, useToggleStar } from "@/hooks/use-articles";
import { planOptimisticRetainOnRead } from "@/lib/articles/article-read-projection";
import { localizeUserVisibleAppErrorMessage } from "@/lib/ui/localize-app-error-message";
import { usePlatformStore } from "@/stores/platform-store";
import { useUiStore } from "@/stores/ui-store";
import { addArticleToReadingList, copyArticleLink, openArticleInExternalBrowser } from "../../article-browser-actions";
import { removeRetainedArticle } from "../../retained-articles";

export type ArticleCommands = {
  setRead: (read: boolean) => void;
  setStarred: (starred: boolean) => void;
  toggleRead: () => void;
  toggleStar: () => void;
  openInExternalBrowser: () => void;
  copyLink: () => void;
  addToReadingList: () => void;
};

export function useArticleCommands(article: ArticleDto | null): ArticleCommands {
  const { t } = useTranslation("reader");
  const { mutate: setReadMutate } = useSetRead();
  const { mutate: toggleStarMutate } = useToggleStar();
  const showToast = useUiStore((s) => s.showToast);
  const addRecentlyRead = useUiStore((s) => s.addRecentlyRead);
  const removeRecentlyRead = useUiStore((s) => s.removeRecentlyRead);
  const retainArticle = useUiStore((s) => s.retainArticle);
  const selection = useUiStore((s) => s.selection);
  const viewMode = useUiStore((s) => s.viewMode);
  const supportsReadingList = usePlatformStore((s) => s.platform.capabilities.supports_reading_list);
  const retainOnUnstar = viewMode === "starred" || (selection.type === "smart" && selection.kind === "starred");
  const articleId = article?.id ?? null;
  const articleUrl = article?.url ?? null;
  const isRead = article?.is_read ?? false;
  const isStarred = article?.is_starred ?? false;

  const setRead = useCallback(
    (read: boolean) => {
      if (!articleId) {
        return;
      }

      const retainPlan = planOptimisticRetainOnRead({
        viewMode,
        markingRead: read,
        isAlreadyRetained: useUiStore.getState().retainedArticleIds.has(articleId),
      });
      const selectedAccountId = useUiStore.getState().selectedAccountId;
      if (retainPlan.shouldRetain) {
        retainArticle(articleId);
      }
      setReadMutate(
        { id: articleId, read },
        {
          onSuccess: () => {
            if (read) {
              clearManualUnreadAutoMarkSuppression(selectedAccountId, articleId);
              addRecentlyRead(articleId);
            } else {
              suppressAutoMarkAfterManualUnread(selectedAccountId, articleId);
              removeRecentlyRead(articleId);
            }
          },
          onError: (error) => {
            if (retainPlan.shouldRollbackOnError) {
              removeRetainedArticle(articleId);
            }
            showToast(localizeUserVisibleAppErrorMessage(error.message));
          },
        },
      );
    },
    [addRecentlyRead, articleId, removeRecentlyRead, retainArticle, setReadMutate, showToast, viewMode],
  );

  const setStarred = useCallback(
    (starred: boolean) => {
      if (!articleId) {
        return;
      }

      toggleStarMutate(
        { id: articleId, starred },
        {
          onSuccess: () => {
            if (!starred && retainOnUnstar) {
              retainArticle(articleId);
            }
          },
          onError: (error) => {
            showToast(localizeUserVisibleAppErrorMessage(error.message));
          },
        },
      );
    },
    [articleId, retainArticle, retainOnUnstar, showToast, toggleStarMutate],
  );

  const toggleRead = useCallback(() => {
    if (!articleId) {
      return;
    }

    setRead(!isRead);
  }, [articleId, isRead, setRead]);

  const toggleStar = useCallback(() => {
    if (!articleId) {
      return;
    }

    setStarred(!isStarred);
  }, [articleId, isStarred, setStarred]);

  const openInExternalBrowser = useCallback(() => {
    if (!articleUrl) {
      return;
    }

    void openArticleInExternalBrowser(articleUrl, showToast);
  }, [articleUrl, showToast]);

  const copyLink = useCallback(() => {
    if (!articleUrl) {
      return;
    }

    void copyArticleLink(articleUrl, {
      showToast,
      successMessage: t("link_copied"),
    });
  }, [articleUrl, showToast, t]);

  const addToReadingList = useCallback(() => {
    if (!supportsReadingList || !articleUrl) {
      return;
    }

    void addArticleToReadingList(articleUrl, {
      showToast,
      successMessage: t("added_to_reading_list"),
    });
  }, [articleUrl, showToast, supportsReadingList, t]);

  return { setRead, setStarred, toggleRead, toggleStar, openInExternalBrowser, copyLink, addToReadingList };
}
