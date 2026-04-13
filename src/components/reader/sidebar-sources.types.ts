import type { AccountDto, ArticleDto, FeedDto, FolderDto, TagDto } from "@/api/tauri-commands";

export type SidebarSourcesParams = {
  selectedAccountId: string | null;
};

export type SidebarAccountStatusLabelSource = Pick<AccountDto, "id">;
export type SidebarAccountStatusLabels = Record<string, string>;
export type SidebarAccountStatusLabelsParams = readonly SidebarAccountStatusLabelSource[] | undefined;

export type SidebarSourcesResult = {
  accounts: AccountDto[] | undefined;
  accountStatusLabels: SidebarAccountStatusLabels;
  selectedAccount: AccountDto | undefined;
  feeds: FeedDto[] | undefined;
  folders: FolderDto[] | undefined;
  tags: TagDto[] | undefined;
  tagArticleCounts: Record<string, number> | undefined;
  accountArticles: ArticleDto[] | undefined;
  feedList: FeedDto[];
  folderList: FolderDto[];
  totalUnread: number;
  starredCount: number;
};
