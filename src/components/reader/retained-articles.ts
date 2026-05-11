import { useUiStore } from "@/stores/ui-store";

export function removeRetainedArticle(articleId: string) {
  useUiStore.setState((state) => {
    if (!state.retainedArticleIds.has(articleId)) {
      return state;
    }

    const retainedArticleIds = new Set(state.retainedArticleIds);
    retainedArticleIds.delete(articleId);
    return { retainedArticleIds };
  });
}
