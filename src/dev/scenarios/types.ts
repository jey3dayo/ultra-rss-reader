import type { QueryClient } from "@tanstack/react-query";
import type { AccountDto, ArticleDto, FeedDto, TagDto } from "@/api/tauri-commands";
import { DEV_SCENARIO_IDS, type DevScenarioId } from "@/lib/dev-scenario-ids";

export type { DevScenarioId };
export { DEV_SCENARIO_IDS };

export type DevScenarioContext = {
  readonly ui: {
    selectedAccountId: string | null;
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
    openSettings(
      tab?: "general" | "appearance" | "mute" | "reading" | "shortcuts" | "actions" | "data" | "debug" | "accounts",
    ): void;
    openAddFeedDialog(): void;
    openCommandPalette(): void;
    closeCommandPalette(): void;
    toggleCommandPalette(): void;
  };
  readonly queryClient: Pick<QueryClient, "setQueryData" | "getQueryData">;
  readonly actions: {
    executeAction(actionId: string): Promise<void> | void;
    listAccounts(): Promise<AccountDto[]> | AccountDto[];
    listFeeds(accountId: string): Promise<FeedDto[]> | FeedDto[];
    listArticles(feedId: string, offset?: number, limit?: number): Promise<ArticleDto[]> | ArticleDto[];
    listTags(): Promise<TagDto[]> | TagDto[];
    getTagArticleCounts(accountId?: string): Promise<Record<string, number>> | Record<string, number>;
    listArticlesByTag(
      tagId: string,
      offset?: number,
      limit?: number,
      accountId?: string,
    ): Promise<ArticleDto[]> | ArticleDto[];
  };
};

export type DevScenario = {
  readonly id: DevScenarioId;
  readonly title: string;
  readonly keywords: readonly string[];
  readonly run: (ctx: DevScenarioContext) => Promise<void> | void;
};
