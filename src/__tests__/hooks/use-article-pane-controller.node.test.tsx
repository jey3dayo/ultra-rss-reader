import "@testing-library/react/dont-cleanup-after-each";
import { act, cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { sampleArticles, sampleFeeds } from "@tests/helpers/fixtures";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useArticlePaneController } from "@/components/reader/hooks/article/use-article-pane-controller";
import i18n from "@/lib/i18n";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

setupBrowserTestDom();

const DATABASE_MAINTENANCE_BUSY_MESSAGE =
  "Database maintenance is unavailable while syncing. Try again after sync completes.";

const { recordArticleViewMutate, setReadMutate } = vi.hoisted(() => ({
  recordArticleViewMutate: vi.fn(),
  setReadMutate: vi.fn(),
}));

vi.mock("@/hooks/use-articles", () => ({
  useRecordArticleView: () => ({ mutate: recordArticleViewMutate }),
  useSetRead: () => ({ mutate: setReadMutate }),
}));

vi.mock("@/components/reader/hooks/article/use-article-browser-overlay", () => ({
  useArticleBrowserOverlay: () => ({
    isBrowserOpen: false,
    resolvedDisplay: { readerMode: true, fallbackReason: undefined },
    handleOpenBrowserOverlay: vi.fn(),
    handleCloseBrowserOverlay: vi.fn(),
    handleBrowserWebviewClosed: vi.fn(),
    handleToggleBrowserOverlay: vi.fn(),
  }),
}));

vi.mock("@/components/reader/hooks/article/use-article-toolbar-controls", () => ({
  useArticleToolbarControls: () => ({
    actionOptions: { canCopyLink: false },
    labels: { copyLink: "Copy link" },
    onCopyLink: vi.fn(),
  }),
}));

vi.mock("@/components/reader/hooks/article/use-article-auto-mark", () => ({
  useArticleAutoMark: () => undefined,
}));

describe("useArticlePaneController article view recording", () => {
  afterEach(async () => {
    cleanup();
    await new Promise<void>((resolve) => setImmediate(resolve));
    recordArticleViewMutate.mockReset();
    setReadMutate.mockReset();
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    useUiStore.setState(useUiStore.getInitialState());
    await i18n.changeLanguage("en");
  });

  it("localizes a backend database-maintenance-busy failure when recording the article view fails", async () => {
    await i18n.changeLanguage("ja");
    const showToast = vi.fn();
    useUiStore.setState({ showToast });
    recordArticleViewMutate.mockImplementation((_variables, options) => {
      options?.onError?.({ type: "UserVisible", message: DATABASE_MAINTENANCE_BUSY_MESSAGE });
    });

    await act(async () => {
      renderHook(() => useArticlePaneController({ article: sampleArticles[0], feed: sampleFeeds[0] }));
    });

    expect(recordArticleViewMutate).toHaveBeenCalledWith(
      { accountId: sampleFeeds[0].account_id, articleId: sampleArticles[0].id },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
    expect(showToast).toHaveBeenCalledWith(i18n.t("errors.database_maintenance_busy", { ns: "common" }));
    expect(showToast).not.toHaveBeenCalledWith(DATABASE_MAINTENANCE_BUSY_MESSAGE);
  });
});
