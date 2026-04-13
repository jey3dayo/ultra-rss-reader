import { useMemo } from "react";
import { useAccounts } from "@/hooks/use-accounts";
import { useAccountArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { useTagArticleCounts, useTags } from "@/hooks/use-tags";
import type { SidebarSourcesParams, SidebarSourcesResult } from "./sidebar-sources.types";
import { useSidebarAccountStatusLabels } from "./use-sidebar-account-status-labels";

export function useSidebarSources({ selectedAccountId }: SidebarSourcesParams): SidebarSourcesResult {
  const { data: accounts } = useAccounts();
  const { data: feeds } = useFeeds(selectedAccountId);
  const { data: folders } = useFolders(selectedAccountId);
  const { data: tags } = useTags();
  const { data: tagArticleCounts } = useTagArticleCounts(selectedAccountId);
  const { data: accountArticles } = useAccountArticles(selectedAccountId);

  const accountStatusLabels = useSidebarAccountStatusLabels(accounts);
  const selectedAccount = useMemo(
    () => accounts?.find((account) => account.id === selectedAccountId),
    [accounts, selectedAccountId],
  );
  const feedList = feeds ?? [];
  const folderList = folders ?? [];
  const totalUnread = useMemo(() => feedList.reduce((sum, feed) => sum + feed.unread_count, 0), [feedList]);
  const starredCount = useMemo(
    () => accountArticles?.filter((article) => article.is_starred).length ?? 0,
    [accountArticles],
  );

  return {
    accounts,
    accountStatusLabels,
    selectedAccount,
    feeds,
    folders,
    tags,
    tagArticleCounts,
    accountArticles,
    feedList,
    folderList,
    totalUnread,
    starredCount,
  };
}
