import type { FeedDto } from "../../api/tauri-commands";
import { useUiStore } from "../../stores/ui-store";
import { SelectableItem } from "../SelectableItem";
import { truncateStyle } from "../styles";

export function FeedItem({ feed, isSelected }: { feed: FeedDto; isSelected: boolean }) {
  const selectFeed = useUiStore((s) => s.selectFeed);
  return (
    <SelectableItem
      isSelected={isSelected}
      onClick={() => selectFeed(feed.id)}
      style={{ justifyContent: "space-between", fontSize: "var(--font-size-sm)" }}
    >
      <span style={truncateStyle}>{feed.title}</span>
      {feed.unread_count > 0 && (
        <span style={{ color: "var(--text-muted)", flexShrink: 0, marginLeft: "var(--space-sm)" }}>
          {feed.unread_count}
        </span>
      )}
    </SelectableItem>
  );
}
