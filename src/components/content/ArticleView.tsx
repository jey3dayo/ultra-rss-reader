import { useArticles } from "../../hooks/use-articles";
import { useUiStore } from "../../stores/ui-store";
import { ArticleContent } from "./ArticleContent";
import { ArticleHeader } from "./ArticleHeader";
import { ArticleToolbar } from "./ArticleToolbar";

export function ArticleView({ articleId }: { articleId: string }) {
  const { selection } = useUiStore();
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const { data: articles } = useArticles(feedId);
  const article = articles?.find((a) => a.id === articleId);

  if (!article) {
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
        Article not found
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg-content)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <ArticleToolbar article={article} />
      <div style={{ flex: 1, overflow: "auto", padding: "var(--space-content) 40px" }}>
        <ArticleHeader article={article} />
        <ArticleContent html={article.content_sanitized} />
      </div>
    </div>
  );
}
