import { getPrimarySourceContext } from "./article-selection-context";
import { useArticleListSearch } from "./use-article-list-search";
import { useArticleListSources } from "./use-article-list-sources";
import { useArticleListUiState } from "./use-article-list-ui-state";

export function useArticleListRuntime() {
  const uiState = useArticleListUiState();
  const selectionContext = getPrimarySourceContext(uiState.selection, uiState.selectedAccountId);
  const sources = useArticleListSources({
    selection: uiState.selection,
    selectionContext,
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
