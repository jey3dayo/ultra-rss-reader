import { useMemo } from "react";
import { useSidebarAccountStatusLabels } from "@/components/reader/hooks/sidebar/use-sidebar-account-status-labels";
import { useAccounts } from "@/hooks/use-accounts";
import { useAccountArticles, useAccountStarredCount, useStarredArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { adoptSnapshotByKey, useScreenSnapshot } from "@/hooks/use-screen-snapshot";
import { useTagArticleCounts, useTags } from "@/hooks/use-tags";
import { buildStarredCountByFeedId, sumUnreadCounts } from "@/lib/sidebar";
import type { SidebarSourcesParams, SidebarSourcesResult } from "../../sidebar-sources.types";

export function useSidebarSources({ selectedAccountId }: SidebarSourcesParams): SidebarSourcesResult {
  const { data: accounts } = useAccounts();
  const { data: feeds } = useFeeds(selectedAccountId);
  const { data: folders } = useFolders(selectedAccountId);
  const { data: tags } = useTags();
  const { data: tagArticleCounts } = useTagArticleCounts(selectedAccountId);
  const { data: accountArticles } = useAccountArticles(selectedAccountId);
  const { data: starredArticles } = useStarredArticles(selectedAccountId);
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
  const adoptedSnapshot = adoptSnapshotByKey(sidebarSnapshot, "accountId", selectedAccountId);
  const isFeedTreeLoading = selectedAccountId !== null && (feeds === undefined || folders === undefined);
  const showFeedTreeSkeleton = isFeedTreeLoading && adoptedSnapshot === null;
  const feedList = adoptedSnapshot?.feeds ?? feeds ?? [];
  const folderList = adoptedSnapshot?.folders ?? folders ?? [];
  const starredCountByFeedId = useMemo(() => buildStarredCountByFeedId(starredArticles), [starredArticles]);
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
  const adoptedCountsSnapshot = adoptSnapshotByKey(sidebarCountsSnapshot, "accountId", selectedAccountId);
  const resolvedTagArticleCounts = adoptedCountsSnapshot?.tagArticleCounts ?? tagArticleCounts;
  const starredCount = adoptedCountsSnapshot?.starredCount ?? accountStarredCount ?? 0;
  const totalUnread = useMemo(() => sumUnreadCounts(feedList), [feedList]);

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
    starredCountByFeedId,
    feedList,
    folderList,
    totalUnread,
    starredCount,
  };
}
