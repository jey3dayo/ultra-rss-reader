import { useUiStore } from "../../stores/ui-store";
import { ArticleView } from "./ArticleView";
import { EmptyState } from "./EmptyState";

export function ContentPane() {
  const { contentMode, selectedArticleId } = useUiStore();

  if (contentMode === "empty" || !selectedArticleId) {
    return <EmptyState />;
  }
  if (contentMode === "browser") {
    return (
      <div
        style={{
          background: "var(--bg-content)",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
        }}
      >
        Browser View (Plan 3)
      </div>
    );
  }
  return <ArticleView articleId={selectedArticleId} />;
}
