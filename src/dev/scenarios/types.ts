import type { QueryClient } from "@tanstack/react-query";

export const DEV_SCENARIO_IDS = [
  "image-viewer-overlay",
  "open-feed-first-article",
  "open-tag-view",
  "open-add-feed-dialog",
  "sync-all-smoke",
] as const;

export type DevScenarioId = (typeof DEV_SCENARIO_IDS)[number];

export type DevScenarioContext = {
  readonly ui: {
    showToast(message: string): void;
    selectAccount(id: string): void;
    selectFeed(feedId: string): void;
    selectFolder(folderId: string): void;
    selectSmartView(kind: "unread" | "starred"): void;
    selectTag(tagId: string): void;
    selectAll(): void;
    selectArticle(id: string): void;
    openBrowser(url: string): void;
    setViewMode(mode: "all" | "unread" | "starred"): void;
    openAddFeedDialog(): void;
    openCommandPalette(): void;
    closeCommandPalette(): void;
    toggleCommandPalette(): void;
  };
  readonly queryClient: Pick<QueryClient, "setQueryData" | "getQueryData">;
  readonly actions: {
    executeAction(actionId: string): Promise<void> | void;
    listAccounts(): Promise<unknown[]> | unknown[];
    listFeeds(accountId: string): Promise<unknown[]> | unknown[];
    listArticles(feedId: string, offset?: number, limit?: number): Promise<unknown[]> | unknown[];
  };
};

export type DevScenario = {
  readonly id: DevScenarioId;
  readonly title: string;
  readonly keywords: readonly string[];
  readonly run: (ctx: DevScenarioContext) => Promise<void> | void;
};
