import { useUiStore } from "../../stores/ui-store";
import { ArticleView } from "./ArticleView";
import { BrowserView } from "./BrowserView";
import { EmptyState } from "./EmptyState";

export function ContentPane() {
  const { contentMode, selectedArticleId } = useUiStore();

  if (contentMode === "browser") {
    return <BrowserView />;
  }
  if (contentMode === "empty" || !selectedArticleId) {
    return <EmptyState />;
  }
  return <ArticleView articleId={selectedArticleId} />;
}
