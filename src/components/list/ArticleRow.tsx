import type { ArticleDto } from "../../api/tauri-commands";
import { useUiStore } from "../../stores/ui-store";
import { SelectableItem } from "../SelectableItem";
import { truncateStyle } from "../styles";

export function ArticleRow({ article }: { article: ArticleDto }) {
  const { selectedArticleId, selectArticle } = useUiStore();
  const isSelected = selectedArticleId === article.id;
  const time = new Date(article.published_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <SelectableItem
      isSelected={isSelected}
      onClick={() => selectArticle(article.id)}
      style={{
        padding: "var(--space-lg) var(--space-lg)",
        gap: "var(--space-md)",
        borderBottom: "1px solid var(--border-divider)",
        borderRadius: 0,
        opacity: article.is_read ? 0.6 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--font-size-md)",
            fontWeight: article.is_read ? "normal" : "bold",
            color: "var(--text-primary)",
            ...truncateStyle,
          }}
        >
          {article.title}
        </div>
        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-muted)", marginTop: 2 }}>{time}</div>
      </div>
      {article.thumbnail && (
        <img
          src={article.thumbnail}
          alt=""
          style={{ width: 48, height: 48, borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
        />
      )}
    </SelectableItem>
  );
}
