import { act, renderHook, waitFor } from "@testing-library/react";
import { flushMicrotasksAndRealTimer } from "@tests/helpers/async-flush";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { sampleArticles } from "@tests/helpers/fixtures";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import type { MockTauriCommandCall } from "@tests/helpers/tauri-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleDto } from "@/api/tauri-commands";
import {
  clearManualUnreadAutoMarkSuppressionsForTests,
  useArticleAutoMark,
} from "@/components/reader/hooks/article/use-article-auto-mark";
import { useArticleCommands } from "@/components/reader/hooks/article/use-article-commands";
import { useSetRead } from "@/hooks/use-articles";
import i18n from "@/lib/i18n";
import { usePlatformStore } from "@/stores/platform-store";
import { useUiStore } from "@/stores/ui-store";

const busyMessage = "Database maintenance is unavailable while syncing. Try again after sync completes.";

function requireArticle(index: number): ArticleDto {
  const article = sampleArticles[index];
  if (!article) {
    throw new Error("sample article fixture is missing");
  }
  return article;
}

function setReadingListSupport(enabled: boolean) {
  usePlatformStore.setState({
    platform: {
      kind: enabled ? "macos" : "windows",
      capabilities: {
        supports_reading_list: enabled,
        supports_background_browser_open: false,
        supports_runtime_window_icon_replacement: true,
        supports_native_browser_navigation: true,
        uses_dev_file_credentials: false,
      },
    },
    loaded: true,
    loadError: false,
    inFlightLoad: null,
  });
}

function installIpc(failing: readonly string[] = []) {
  const calls: MockTauriCommandCall[] = [];
  setupTauriMocks((cmd, args) => {
    calls.push({ cmd, args });
    if (failing.includes(cmd)) {
      throw { type: "UserVisible", message: busyMessage };
    }
    return null;
  });
  return calls;
}

function renderCommands(article: ArticleDto | null) {
  const { wrapper } = createQueryWrapper();
  return renderHook(() => useArticleCommands(article), { wrapper });
}

describe("useArticleCommands", () => {
  const unreadArticle = { ...requireArticle(0), is_read: false, is_starred: false };
  const showToast = vi.fn();

  beforeEach(async () => {
    await i18n.changeLanguage("en");
    showToast.mockReset();
    clearManualUnreadAutoMarkSuppressionsForTests();
    useUiStore.setState({ ...useUiStore.getInitialState(), showToast });
    setReadingListSupport(true);
  });

  it("marks read via mark_article_read and adds recently-read on success", async () => {
    const calls = installIpc();
    const { result } = renderCommands(unreadArticle);

    act(() => result.current.setRead(true));

    await waitFor(() => expect(useUiStore.getState().recentlyReadIds.has(unreadArticle.id)).toBe(true));
    expect(calls.filter((call) => call.cmd === "mark_article_read")).toEqual([
      { cmd: "mark_article_read", args: { articleId: unreadArticle.id, read: true } },
    ]);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("marks unread, removes recently-read and suppresses auto-mark for the article", async () => {
    const calls = installIpc();
    const readArticle = { ...unreadArticle, is_read: true };
    useUiStore.getState().addRecentlyRead(readArticle.id);
    const { wrapper } = createQueryWrapper();
    const { result, rerender } = renderHook(
      ({ article }: { article: ArticleDto }) => {
        const setRead = useSetRead();
        const commands = useArticleCommands(article);
        useArticleAutoMark({
          articleId: article.id,
          isRead: article.is_read,
          articleEngagement: "reading",
          afterReading: "immediately",
          viewMode: "all",
          retainArticle: () => {},
          addRecentlyRead: () => {},
          setRead,
          showToast,
        });
        return commands;
      },
      { wrapper, initialProps: { article: readArticle } },
    );

    act(() => result.current.setRead(false));
    await waitFor(() => expect(useUiStore.getState().recentlyReadIds.has(readArticle.id)).toBe(false));
    rerender({ article: { ...readArticle, is_read: false } });
    await flushMicrotasksAndRealTimer();

    expect(calls.filter((call) => call.cmd === "mark_article_read")).toEqual([
      { cmd: "mark_article_read", args: { articleId: readArticle.id, read: false } },
    ]);
  });

  it("rolls back a newly retained article and shows a localized toast when mark_article_read fails", async () => {
    installIpc(["mark_article_read"]);
    useUiStore.setState({ viewMode: "unread" });
    const { result } = renderCommands(unreadArticle);

    act(() => result.current.setRead(true));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith(i18n.t("errors.database_maintenance_busy")));
    expect(useUiStore.getState().retainedArticleIds.has(unreadArticle.id)).toBe(false);
  });

  it("keeps a pre-existing retained article when mark_article_read fails", async () => {
    installIpc(["mark_article_read"]);
    useUiStore.setState({ viewMode: "unread" });
    useUiStore.getState().retainArticle(unreadArticle.id);
    const { result } = renderCommands(unreadArticle);

    act(() => result.current.setRead(true));

    await waitFor(() => expect(showToast).toHaveBeenCalled());
    expect(useUiStore.getState().retainedArticleIds.has(unreadArticle.id)).toBe(true);
  });

  it("keeps recently-read state unchanged when marking unread fails", async () => {
    installIpc(["mark_article_read"]);
    const readArticle = { ...unreadArticle, is_read: true };
    useUiStore.getState().addRecentlyRead(readArticle.id);
    const { result } = renderCommands(readArticle);

    act(() => result.current.setRead(false));

    await waitFor(() => expect(showToast).toHaveBeenCalled());
    expect(useUiStore.getState().recentlyReadIds.has(readArticle.id)).toBe(true);
  });

  it("retains the article after unstar succeeds in the starred view", async () => {
    installIpc();
    useUiStore.setState({ viewMode: "starred" });
    const starredArticle = { ...unreadArticle, is_starred: true };
    const { result } = renderCommands(starredArticle);

    act(() => result.current.toggleStar());

    await waitFor(() => expect(useUiStore.getState().retainedArticleIds.has(starredArticle.id)).toBe(true));
  });

  it("does not retain when toggle_article_star fails", async () => {
    installIpc(["toggle_article_star"]);
    useUiStore.setState({ viewMode: "starred" });
    const starredArticle = { ...unreadArticle, is_starred: true };
    const { result } = renderCommands(starredArticle);

    act(() => result.current.setStarred(false));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith(i18n.t("errors.database_maintenance_busy")));
    expect(useUiStore.getState().retainedArticleIds.has(starredArticle.id)).toBe(false);
  });

  it("issues no IPC when article is null", async () => {
    const calls = installIpc();
    const { result } = renderCommands(null);

    act(() => {
      result.current.setRead(true);
      result.current.setStarred(true);
      result.current.toggleRead();
      result.current.toggleStar();
      result.current.openInExternalBrowser();
      result.current.copyLink();
      result.current.addToReadingList();
    });
    await Promise.resolve();

    expect(calls).toEqual([]);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("skips add_to_reading_list when the platform lacks support", async () => {
    setReadingListSupport(false);
    const calls = installIpc();
    const { result } = renderCommands(unreadArticle);

    act(() => result.current.addToReadingList());
    await Promise.resolve();

    expect(calls.filter((call) => call.cmd === "add_to_reading_list")).toEqual([]);
  });
});
