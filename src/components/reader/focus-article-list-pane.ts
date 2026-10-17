import { focusArticleListRowTargetWhenReady } from "@/lib/reader-focus";
import { useUiStore } from "@/stores/ui-store";

export function focusArticleListPane() {
  const store = useUiStore.getState();
  store.setFocusedPane("list");
  focusArticleListRowTargetWhenReady(store.selectedArticleId);
}
