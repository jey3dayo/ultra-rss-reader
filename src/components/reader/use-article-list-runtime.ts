import type { UiSelection } from "@/stores/ui-store";
import type { ArticleListPrimarySourceContext } from "./article-list.types";
import { useArticleListSearch } from "./use-article-list-search";
import { useArticleListSources } from "./use-article-list-sources";
import { useArticleListUiState } from "./use-article-list-ui-state";

function getPrimarySourceContext(
  selection: UiSelection,
  selectedAccountId: string | null,
): ArticleListPrimarySourceContext {
  switch (selection.type) {
    case "feed":
      return {
        kind: "feed",
        key: `feed:${selectedAccountId ?? "null"}:${selection.feedId}`,
      };
    case "tag":
      return {
        kind: "tag",
        key: `tag:${selectedAccountId ?? "null"}:${selection.tagId}`,
      };
    case "folder":
      return {
        kind: "account",
        key: `account:${selectedAccountId ?? "null"}:folder:${selection.folderId}`,
      };
    case "smart":
      return {
        kind: "account",
        key: `account:${selectedAccountId ?? "null"}:smart:${selection.kind}`,
      };
    case "all":
      return {
        kind: "account",
        key: `account:${selectedAccountId ?? "null"}:all`,
      };
  }
}

export function useArticleListRuntime() {
  const uiState = useArticleListUiState();
  const selectionContext = getPrimarySourceContext(uiState.selection, uiState.selectedAccountId);
  const sources = useArticleListSources({
    selection: uiState.selection,
    selectionContext,
    selectedAccountId: uiState.selectedAccountId,
  });
  const search = useArticleListSearch({ selectedAccountId: uiState.selectedAccountId });

  return {
    ...uiState,
    ...sources,
    ...search,
  };
}
