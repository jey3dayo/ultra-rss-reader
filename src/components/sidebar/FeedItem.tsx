import type { FeedDto } from "../../api/tauri-commands";
import { useUiStore } from "../../stores/ui-store";

export function FeedItem({ feed, isSelected }: { feed: FeedDto; isSelected: boolean }) {
  const selectFeed = useUiStore((s) => s.selectFeed);
  return (
    <button
      type="button"
      onClick={() => selectFeed(feed.id)}
      style={{
        padding: "var(--space-xs) var(--space-sm)",
        borderRadius: 4,
        cursor: "pointer",
        display: "flex",
        justifyContent: "space-between",
        background: isSelected ? "var(--bg-selected)" : "transparent",
        color: "var(--text-secondary)",
        fontSize: "var(--font-size-sm)",
        border: "none",
        width: "100%",
        textAlign: "left",
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{feed.title}</span>
      {feed.unread_count > 0 && (
        <span style={{ color: "var(--text-muted)", flexShrink: 0, marginLeft: "var(--space-sm)" }}>
          {feed.unread_count}
        </span>
      )}
    </button>
  );
}
