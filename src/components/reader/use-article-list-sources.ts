import { useAccountArticles, useArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { useArticlesByTag } from "@/hooks/use-tags";
import type { UiSelection } from "@/stores/ui-store";

type UseArticleListSourcesParams = {
  selection: UiSelection;
  selectedAccountId: string | null;
};

export function useArticleListSources({ selection, selectedAccountId }: UseArticleListSourcesParams) {
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const folderId = selection.type === "folder" ? selection.folderId : null;
  const tagId = selection.type === "tag" ? selection.tagId : null;
  const smartViewKind = selection.type === "smart" ? selection.kind : null;
  const accountListScopeId = feedId || tagId ? null : selectedAccountId;
  const { data: feeds } = useFeeds(selectedAccountId);
  const { data: articles, isLoading } = useArticles(feedId);
  const { data: accountArticles, isLoading: isLoadingAccountArticles } = useAccountArticles(accountListScopeId);
  const { data: tagArticles, isLoading: isLoadingTagArticles } = useArticlesByTag(tagId, selectedAccountId);

  return {
    feedId,
    folderId,
    tagId,
    smartViewKind,
    accountListScopeId,
    feeds,
    articles,
    accountArticles,
    tagArticles,
    isLoading,
    isLoadingAccountArticles,
    isLoadingTagArticles,
  };
}
