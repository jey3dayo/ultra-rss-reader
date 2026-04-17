import { useMemo } from "react";
import { useAccounts } from "@/hooks/use-accounts";
import { useAccountArticles, useAccountStarredCount } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { useScreenSnapshot } from "@/hooks/use-screen-snapshot";
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
  const { data: accountStarredCount } = useAccountStarredCount(selectedAccountId);

  const accountStatusLabels = useSidebarAccountStatusLabels(accounts);
  const selectedAccount = useMemo(
    () => accounts?.find((account) => account.id === selectedAccountId),
    [accounts, selectedAccountId],
  );
  const sidebarSnapshotCandidate = useMemo(
    () =>
      selectedAccountId !== null && feeds !== undefined && folders !== undefined
        ? { accountId: selectedAccountId, feeds, folders }
        : null,
    [feeds, folders, selectedAccountId],
  );
  const { snapshot: sidebarSnapshot } = useScreenSnapshot(sidebarSnapshotCandidate, sidebarSnapshotCandidate !== null);
  const adoptedSnapshot = sidebarSnapshot?.accountId === selectedAccountId ? sidebarSnapshot : null;
  const isFeedTreeLoading = selectedAccountId !== null && (feeds === undefined || folders === undefined);
  const showFeedTreeSkeleton = isFeedTreeLoading && adoptedSnapshot === null;
  const feedList = adoptedSnapshot?.feeds ?? feeds ?? [];
  const folderList = adoptedSnapshot?.folders ?? folders ?? [];
  const totalUnread = useMemo(() => feedList.reduce((sum, feed) => sum + feed.unread_count, 0), [feedList]);
  const sidebarCountsSnapshotCandidate = useMemo(
    () =>
      selectedAccountId !== null && tagArticleCounts !== undefined && accountStarredCount !== undefined
        ? {
            accountId: selectedAccountId,
            tagArticleCounts,
            starredCount: accountStarredCount,
          }
        : null,
    [accountStarredCount, selectedAccountId, tagArticleCounts],
  );
  const { snapshot: sidebarCountsSnapshot } = useScreenSnapshot(
    sidebarCountsSnapshotCandidate,
    sidebarCountsSnapshotCandidate !== null,
  );
  const adoptedCountsSnapshot = sidebarCountsSnapshot?.accountId === selectedAccountId ? sidebarCountsSnapshot : null;
  const resolvedTagArticleCounts = adoptedCountsSnapshot?.tagArticleCounts ?? tagArticleCounts;
  const starredCount = adoptedCountsSnapshot?.starredCount ?? accountStarredCount ?? 0;

  return {
    accounts,
    accountStatusLabels,
    selectedAccount,
    feeds: adoptedSnapshot?.feeds ?? feeds,
    folders: adoptedSnapshot?.folders ?? folders,
    isFeedTreeLoading,
    showFeedTreeSkeleton,
    tags,
    tagArticleCounts: resolvedTagArticleCounts,
    accountArticles,
    feedList,
    folderList,
    totalUnread,
    starredCount,
  };
}
