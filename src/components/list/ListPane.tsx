import { useArticles } from "../../hooks/use-articles";
import { useUiStore } from "../../stores/ui-store";
import { ArticleList } from "./ArticleList";
import { ListHeader } from "./ListHeader";

export function ListPane() {
  const { selection } = useUiStore();
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const { data: articles, isLoading } = useArticles(feedId);

  return (
    <div
      style={{
        background: "var(--bg-list)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--border-divider)",
        overflow: "hidden",
      }}
    >
      <ListHeader />
      <div style={{ flex: 1, overflow: "auto" }}>
        {isLoading ? (
          <div style={{ padding: "var(--space-xl)", color: "var(--text-muted)", textAlign: "center" }}>Loading...</div>
        ) : (
          <ArticleList articles={articles ?? []} />
        )}
      </div>
    </div>
  );
}
