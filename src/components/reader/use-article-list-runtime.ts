import { useArticleListSearch } from "./use-article-list-search";
import { useArticleListSources } from "./use-article-list-sources";
import { useArticleListUiState } from "./use-article-list-ui-state";

export function useArticleListRuntime() {
  const uiState = useArticleListUiState();
  const sources = useArticleListSources({
    selection: uiState.selection,
    selectedAccountId: uiState.selectedAccountId,
  });
  const search = useArticleListSearch({ selectedAccountId: uiState.selectedAccountId });

  return {
    ...uiState,
    ...sources,
    ...search,
  };
}
