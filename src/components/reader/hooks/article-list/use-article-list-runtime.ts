import { useArticleListSearch } from "@/components/reader/hooks/article-list/use-article-list-search";
import { useArticleListSources } from "@/components/reader/hooks/article-list/use-article-list-sources";
import { useArticleListUiState } from "@/components/reader/hooks/article-list/use-article-list-ui-state";

export function useArticleListRuntime() {
  const uiState = useArticleListUiState();
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
