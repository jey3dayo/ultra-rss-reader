import type { AccountDto, ArticleDto, FeedDto, FolderDto, TagDto } from "@/api/tauri-commands";

export type SidebarSourcesParams = {
  selectedAccountId: string | null;
};

type SidebarAccountStatusLabelSource = Pick<AccountDto, "id">;
export type SidebarAccountStatusLabels = Record<string, string>;
export type SidebarAccountStatusLabelsParams = readonly SidebarAccountStatusLabelSource[] | undefined;

type SidebarAccountSourceModel = {
  accounts: AccountDto[] | undefined;
  accountStatusLabels: SidebarAccountStatusLabels;
  selectedAccount: AccountDto | undefined;
  accountArticles: ArticleDto[] | undefined;
};

type SidebarFeedTreeSourceModel = {
  feeds: FeedDto[] | undefined;
  folders: FolderDto[] | undefined;
  isFeedTreeLoading: boolean;
  showFeedTreeSkeleton: boolean;
  starredCountByFeedId: ReadonlyMap<string, number>;
  feedList: FeedDto[];
  folderList: FolderDto[];
  totalUnread: number;
  starredCount: number;
};

type SidebarTagSourceModel = {
  tags: TagDto[] | undefined;
  tagArticleCounts: Record<string, number> | undefined;
};

export type SidebarSourcesResult = SidebarAccountSourceModel & SidebarFeedTreeSourceModel & SidebarTagSourceModel;
