import { useArticleListSearch } from "@/components/reader/hooks/article-list/use-article-list-search";
import { useArticleListSources } from "@/components/reader/hooks/article-list/use-article-list-sources";
import { useArticleListUiState } from "@/components/reader/hooks/article-list/use-article-list-ui-state";
import { useCancelReaderQueriesOnAccountSwitch } from "@/hooks/use-cancel-reader-queries-on-account-switch";

export function useArticleListRuntime() {
  const uiState = useArticleListUiState();
  useCancelReaderQueriesOnAccountSwitch(uiState.selectedAccountId);
  const sources = useArticleListSources({
    selection: uiState.selection,
    selectedAccountId: uiState.selectedAccountId,
    selectedArticleId: uiState.selectedArticleId,
    retainedArticleIds: uiState.retainedArticleIds,
    viewMode: uiState.viewMode,
  });
  const search = useArticleListSearch({ selectedAccountId: uiState.selectedAccountId });

  return {
    ...uiState,
    ...sources,
    ...search,
  };
}
